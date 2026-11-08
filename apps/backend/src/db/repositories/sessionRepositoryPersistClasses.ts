import { and, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import {
  SEAT_RELEASED_ENROLLMENT_STATUSES,
  findTimetableCollisions,
  periodTimeErrors,
  type Class,
} from "@mms/shared";
import { randomUUID } from "node:crypto";
import { sessionClasses, enrollments, examClasses } from "../schema.js";
import { type TenantTransaction } from "../tenant-context.js";
import { ConflictError, ValidationError } from "../../lib/httpErrors.js";
import { getSessionModulePreferencesByWorkspace } from "./sessionModulePreferencesRepository.js";
import { persistClassSectionsTx } from "./sessionRepositorySections.js";
import { hasClassReferencesTx } from "./sessionClassReferenceGuard.js";
import {
  collectClassChildRows,
  deleteClassChildrenTx,
  emptyClassChildRows,
  insertClassChildRowsTx,
} from "./sessionRepositoryClassChildren.js";
import { requireDbDate } from "../../lib/dbDate.js";

type Transaction = TenantTransaction;

/**
 * Rejects removing classes that are still referenced — enrollments, attendance (archived rows too,
 * since the FK restricts), exams, fee structures, hasanat distributions or question papers.
 */
async function assertClassesRemovableTx(
  tx: Transaction,
  subdomain: string,
  classIds: string[],
): Promise<void> {
  if (classIds.length === 0) return;
  if (await hasClassReferencesTx(tx, subdomain, classIds)) {
    throw new ConflictError(
      "Cannot remove a class that has enrollments, attendance, exams or fee structures",
    );
  }
  const [enrolled] = await tx
    .select({ id: enrollments.id })
    .from(enrollments)
    // Archived enrollments still hold the (deferred) composite FK, so they block removal too.
    .where(
      and(eq(enrollments.workspaceSubdomain, subdomain), inArray(enrollments.classId, classIds)),
    )
    .limit(1);
  const [examined] = await tx
    .select({ examId: examClasses.examId })
    .from(examClasses)
    .where(
      and(eq(examClasses.workspaceSubdomain, subdomain), inArray(examClasses.classId, classIds)),
    )
    .limit(1);
  if (enrolled || examined) {
    throw new ConflictError("Cannot remove a class that has enrollments, attendance, or exams");
  }
}

/**
 * Persists a session's classes by id: upserts classes present in the payload, replaces their
 * child collections, and deletes only classes missing from the payload (guarded against dependants).
 * `classes === undefined` leaves existing classes untouched.
 */
/** Refuses a class quota below its live enrollment count (sections or no sections). */
async function assertClassCapacityTx(
  tx: Transaction,
  subdomain: string,
  sessionId: string,
  classId: string,
  capacity: number,
): Promise<void> {
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.workspaceSubdomain, subdomain),
        eq(enrollments.sessionId, sessionId),
        eq(enrollments.classId, classId),
        isNull(enrollments.deletedAt),
        notInArray(enrollments.status, [...SEAT_RELEASED_ENROLLMENT_STATUSES]),
      ),
    );
  const occupied = Number(row?.count ?? 0);
  // 0 = no cap (the `maxStudents` default), so the quota check only applies above it.
  if (capacity > 0 && occupied > capacity)
    throw new ConflictError(
      `The class quota (${Math.max(0, capacity)}) cannot be below its ${occupied} enrolled student(s)`,
    );
}

/**
 * Timetable payload validation (migration 0167 gave timetables a date and free-form
 * `start_time`/`end_time`, but nothing ever validated them).
 *
 *  - format/order is always enforced (an invalid or reversed time is never legitimate);
 *  - same-class period overlaps are always refused (a class cannot be in two places);
 *  - teacher double-booking is refused when Sessions → `timetableConflictCheck` is on.
 */
async function assertTimetablePaylodValid(
  classes: readonly Class[],
  subdomain: string,
): Promise<void> {
  for (const cls of classes) {
    for (const timetable of cls.timetables ?? []) {
      const errors = periodTimeErrors(timetable.periods ?? []);
      if (errors.length > 0) {
        const first = errors[0]!;
        throw new ValidationError(
          `${cls.name}: period ${first.index + 1} has an invalid time ` +
            `(use HH:MM, and the end must be after the start)`,
        );
      }
    }
  }
  const preferences = await getSessionModulePreferencesByWorkspace(subdomain);
  const conflictCheck = preferences?.timetableConflictCheck ?? true;
  if (!conflictCheck) return;
  const collisions = findTimetableCollisions(
    classes.map((cls) => ({
      id: cls.id,
      name: cls.name,
      timetables: (cls.timetables ?? []).map((timetable) => ({
        date: timetable.date ?? null,
        periods: timetable.periods ?? [],
      })),
    })),
  );
  if (collisions.length > 0) {
    throw new ConflictError(
      collisions[0]!.kind === "faculty_double_booked"
        ? `A teacher is booked in two overlapping periods on ${collisions[0]!.date}`
        : `${collisions[0]!.detail}. Fix the timetable before saving.`,
    );
  }
}

export async function persistSessionClassesTx(
  tx: Transaction,
  subdomain: string,
  sessionId: string,
  classes?: Class[],
): Promise<void> {
  if (classes === undefined) return;

  await assertTimetablePaylodValid(classes, subdomain);

  const payload = classes.map((c) => ({ ...c, id: c.id || randomUUID() }));
  const keptIds = payload.map((c) => c.id);
  const sessionScope = and(
    eq(sessionClasses.workspaceSubdomain, subdomain),
    eq(sessionClasses.sessionId, sessionId),
  );

  const removed = await tx
    .select({ id: sessionClasses.id })
    .from(sessionClasses)
    .where(
      keptIds.length > 0 ? and(sessionScope, notInArray(sessionClasses.id, keptIds)) : sessionScope,
    );
  const removedIds = removed.map((r) => r.id);

  await assertClassesRemovableTx(tx, subdomain, removedIds);
  await deleteClassChildrenTx(tx, subdomain, [...removedIds, ...keptIds]);
  if (removedIds.length > 0) {
    // Removed (unused) classes cascade to their sections' staff history, which is soft-delete guarded.
    await tx.execute(sql`SELECT set_config('app.allow_hard_purge', 'true', true)`);
    await tx
      .delete(sessionClasses)
      .where(and(sessionScope, inArray(sessionClasses.id, removedIds)));
  }

  const childRows = emptyClassChildRows();
  const now = new Date();
  for (let idx = 0; idx < payload.length; idx++) {
    const c = payload[idx];
    const values = {
      sessionId,
      name: c.name,
      gender: c.gender || "mixed",
      ageCalculationDate: requireDbDate(c.ageCalculationDate, "ageCalculationDate"),
      ageMin: c.minAge ?? 4,
      ageMax: c.maxAge ?? 25,
      // Class capacity is the sum of its sections when sections are sent.
      capacity: c.sections?.length
        ? c.sections.reduce((total, section) => total + Math.max(0, section.capacity ?? 0), 0)
        : Math.max(0, c.maxStudents ?? 30),
      enrollmentDeadline: c.enrollmentDeadline || "",
      dropDeadline: c.dropDeadline?.trim() ? c.dropDeadline.trim() : null,
      status: c.status || "active",
      facultyId: c.facultyId?.trim() ? c.facultyId.trim() : null,
      facultyName: c.facultyName || "",
      room: c.room || "",
      programId: c.programId || null,
      sortOrder: idx,
      updatedAt: now,
    };
    // `enrolled` is gone (migration 0211): seat counts are derived from `enrollments`
    // on every read, never stored on the class.
    await tx
      .insert(sessionClasses)
      .values({ id: c.id, workspaceSubdomain: subdomain, ...values })
      .onConflictDoUpdate({
        target: [sessionClasses.workspaceSubdomain, sessionClasses.sessionId, sessionClasses.id],
        // `version` advances on every class write so class-only readers get a real OCC token.
        set: { ...values, version: sql`${sessionClasses.version} + 1` },
      });
    const derivedCapacity = await persistClassSectionsTx(
      tx,
      { subdomain, sessionId, classId: c.id, capacity: values.capacity, room: values.room },
      c.sections,
    );
    // One source of truth: the class quota is the stored active-section sum, and it may never drop
    // below the students already holding a seat (review findings P1/P2).
    await assertClassCapacityTx(tx, subdomain, sessionId, c.id, derivedCapacity);
    if (derivedCapacity !== values.capacity) {
      await tx
        .update(sessionClasses)
        .set({ capacity: derivedCapacity, updatedAt: now })
        .where(
          and(
            eq(sessionClasses.workspaceSubdomain, subdomain),
            eq(sessionClasses.sessionId, sessionId),
            eq(sessionClasses.id, c.id),
          ),
        );
    }
    collectClassChildRows(childRows, subdomain, c.id, c);
  }

  await insertClassChildRowsTx(tx, childRows);
}
