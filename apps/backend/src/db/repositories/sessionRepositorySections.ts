import { and, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import { SEAT_RELEASED_ENROLLMENT_STATUSES } from "@mms/shared";
import { randomUUID } from "node:crypto";
import type { SessionClassSection } from "@mms/shared";
import {
  enrollments,
  sectionStaffAssignments,
  sectionStudentRoles,
  sessionClassSections,
} from "../schema.js";
import type { TenantTransaction } from "../tenant-context.js";
import { ConflictError, ValidationError } from "../../lib/httpErrors.js";
import { hasSectionAttendanceTx } from "./sessionClassReferenceGuard.js";

interface ClassSectionContext {
  subdomain: string;
  sessionId: string;
  classId: string;
  /** Used for the default section when the payload carries none. */
  capacity: number;
  room: string;
}

async function assertSectionsRemovableTx(
  tx: TenantTransaction,
  subdomain: string,
  sectionIds: string[],
): Promise<void> {
  if (sectionIds.length === 0) return;
  const scope = (column: typeof enrollments.sectionId) =>
    and(sql`${column} IS NOT NULL`, inArray(column, sectionIds));
  const [enrolled] = await tx
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(and(eq(enrollments.workspaceSubdomain, subdomain), scope(enrollments.sectionId)))
    .limit(1);
  const [staffed] = await tx
    .select({ id: sectionStaffAssignments.id })
    .from(sectionStaffAssignments)
    .where(
      and(
        eq(sectionStaffAssignments.workspaceSubdomain, subdomain),
        inArray(sectionStaffAssignments.sectionId, sectionIds),
      ),
    )
    .limit(1);
  const [roles] = await tx
    .select({ id: sectionStudentRoles.id })
    .from(sectionStudentRoles)
    .where(
      and(
        eq(sectionStudentRoles.workspaceSubdomain, subdomain),
        inArray(sectionStudentRoles.sectionId, sectionIds),
      ),
    )
    .limit(1);
  if (enrolled || staffed || roles || (await hasSectionAttendanceTx(tx, subdomain, sectionIds))) {
    throw new ConflictError(
      "A section with enrollments, attendance or staff history cannot be removed — close it instead",
    );
  }
}

/**
 * Persists a class's sections by id. `undefined`/empty keeps stored sections and only guarantees
 * one default section ("A"). Returns the class capacity (sum of section capacities).
 */
export async function persistClassSectionsTx(
  tx: TenantTransaction,
  ctx: ClassSectionContext,
  sections: SessionClassSection[] | undefined,
): Promise<number> {
  const { subdomain, sessionId, classId } = ctx;
  const classScope = and(
    eq(sessionClassSections.workspaceSubdomain, subdomain),
    eq(sessionClassSections.classId, classId),
  );

  if (!sections || sections.length === 0) {
    const [existing] = await tx
      .select({ id: sessionClassSections.id })
      .from(sessionClassSections)
      .where(classScope)
      .limit(1);
    if (!existing) {
      await tx.insert(sessionClassSections).values({
        id: randomUUID(),
        workspaceSubdomain: subdomain,
        sessionId,
        classId,
        name: "A",
        capacity: Math.max(0, ctx.capacity),
        room: ctx.room || null,
        sortOrder: 0,
      });
    }
    // The class capacity is the stored active-section sum, never the request's own number: an
    // "empty sections" payload must not desynchronise quota from the seats that actually exist.
    return storedActiveCapacityTx(tx, subdomain, classId);
  }

  const payload = sections.map((section) => ({
    ...section,
    id: section.id || randomUUID(),
    name: section.name.trim(),
  }));
  const names = new Set(payload.map((section) => section.name.toLowerCase()));
  if (names.size !== payload.length)
    throw new ValidationError("Section names must be unique within a class");

  const keptIds = payload.map((section) => section.id);
  // The upsert target is (workspace, id), so a foreign id would be re-parented into this class —
  // carrying its enrollments, staff history and attendance. Reject mismatched ownership.
  const owned = await tx
    .select({
      id: sessionClassSections.id,
      classId: sessionClassSections.classId,
      sessionId: sessionClassSections.sessionId,
    })
    .from(sessionClassSections)
    .where(
      and(
        eq(sessionClassSections.workspaceSubdomain, subdomain),
        inArray(sessionClassSections.id, keptIds),
      ),
    );
  if (owned.some((row) => row.classId !== classId || row.sessionId !== sessionId))
    throw new ValidationError(
      "A section cannot be moved between classes; create a new section instead",
    );
  await assertSectionSeatsTx(tx, subdomain, payload);
  const removed = await tx
    .select({ id: sessionClassSections.id })
    .from(sessionClassSections)
    .where(and(classScope, notInArray(sessionClassSections.id, keptIds)));
  const removedIds = removed.map((row) => row.id);
  await assertSectionsRemovableTx(tx, subdomain, removedIds);
  if (removedIds.length > 0) {
    await tx
      .delete(sessionClassSections)
      .where(and(classScope, inArray(sessionClassSections.id, removedIds)));
  }

  for (let index = 0; index < payload.length; index++) {
    const section = payload[index];
    const values = {
      sessionId,
      classId,
      name: section.name,
      capacity: Math.max(0, section.capacity ?? 0),
      room: section.room?.trim() || null,
      status: section.status ?? "active",
      sortOrder: index,
      // `updated_at` is the section's optimistic-concurrency signal; a stale default lies.
      updatedAt: new Date(),
    };
    await tx
      .insert(sessionClassSections)
      .values({ id: section.id, workspaceSubdomain: subdomain, ...values })
      .onConflictDoUpdate({
        target: [sessionClassSections.workspaceSubdomain, sessionClassSections.id],
        set: values,
      });
  }
  return storedActiveCapacityTx(tx, subdomain, classId);
}

/** Sum of the active section capacities currently stored for the class. */
async function storedActiveCapacityTx(
  tx: TenantTransaction,
  subdomain: string,
  classId: string,
): Promise<number> {
  const [row] = await tx
    .select({ total: sql<number>`COALESCE(SUM("capacity"), 0)::int` })
    .from(sessionClassSections)
    .where(
      and(
        eq(sessionClassSections.workspaceSubdomain, subdomain),
        eq(sessionClassSections.classId, classId),
        eq(sessionClassSections.status, "active"),
      ),
    );
  return Number(row?.total ?? 0);
}

/**
 * Refuses a section-capacity shrink below its live (seat-holding) enrollment count. This is a
 * persistence invariant, independent of the started-session edit lock, so an `open`/`draft` class
 * cannot be oversubscribed either (review finding P2).
 */
async function assertSectionSeatsTx(
  tx: TenantTransaction,
  subdomain: string,
  sections: readonly { id: string; capacity?: number }[],
): Promise<void> {
  const ids = sections.map((section) => section.id);
  if (ids.length === 0) return;
  const live = await tx
    .select({ sectionId: enrollments.sectionId, count: sql<number>`count(*)::int` })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.workspaceSubdomain, subdomain),
        inArray(enrollments.sectionId, ids),
        isNull(enrollments.deletedAt),
        notInArray(enrollments.status, [...SEAT_RELEASED_ENROLLMENT_STATUSES]),
      ),
    )
    .groupBy(enrollments.sectionId);
  const liveBySection = new Map(live.map((row) => [String(row.sectionId), Number(row.count)]));
  for (const section of sections) {
    const occupied = liveBySection.get(section.id) ?? 0;
    if (occupied > Math.max(0, section.capacity ?? 0))
      throw new ConflictError(
        `Section quota cannot drop below its ${occupied} enrolled student(s)`,
      );
  }
}
