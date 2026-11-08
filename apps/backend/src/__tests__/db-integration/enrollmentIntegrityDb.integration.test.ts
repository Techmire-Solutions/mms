import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { and, eq, isNull, sql } from "drizzle-orm";
import { closeDatabase, beginLongLivedTenantTransaction } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import {
  workspaces,
  students,
  sessions,
  sessionClasses,
  sessionClassSections,
  enrollments,
  enrollmentPlacements,
} from "../../db/schema.js";
import {
  saveEnrollment,
  bulkRestoreEnrollments,
} from "../../db/repositories/enrollmentRepositoryPersist.js";
import { applyEnrollmentTransfer } from "../../db/repositories/enrollmentOperationsRepository.js";
import {
  cascadeSoftDeleteEnrollmentsForStudents,
  restoreCascadedEnrollmentsForStudents,
} from "../../db/repositories/studentEnrollmentCascade.js";
import { restoreSessionWithCascade } from "../../db/repositories/sessionRepositoryCascade.js";
import { SeatCapacityError } from "../../lib/httpErrors.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TENANT = "enr-integrity-test";
const SESSION = "ses-integrity";
const CLASS = "cls-integrity";
const SECTION_FULL = "sec-full";
const SECTION_OPEN = "sec-open";

/** Reads one enrollment including its trashed state (FORCE RLS needs the opt-in). */
async function readEnrollmentRow(id: string) {
  return withTenant(TENANT, async (tx) => {
    await tx.execute(sql`SELECT set_config('app.include_deleted', 'true', true)`);
    const [row] = await tx
      .select({ id: enrollments.id, deletedAt: enrollments.deletedAt })
      .from(enrollments)
      .where(and(eq(enrollments.workspaceSubdomain, TENANT), eq(enrollments.id, id)));
    return row;
  });
}

async function seedFixtures(): Promise<void> {
  const tx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
  try {
    await tx.tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.tx.delete(enrollments).where(eq(enrollments.workspaceSubdomain, TENANT));
    await tx.tx
      .delete(sessionClassSections)
      .where(eq(sessionClassSections.workspaceSubdomain, TENANT));
    await tx.tx.delete(sessionClasses).where(eq(sessionClasses.workspaceSubdomain, TENANT));
    await tx.tx.delete(sessions).where(eq(sessions.workspaceSubdomain, TENANT));
    await tx.tx.delete(students).where(eq(students.workspaceSubdomain, TENANT));

    await tx.tx
      .insert(workspaces)
      .values({ id: `ws-${TENANT}`, subdomain: TENANT, madrasaName: "Enrollment Integrity" })
      .onConflictDoNothing();
    await tx.tx.insert(students).values([
      { id: "stu-a", workspaceSubdomain: TENANT, grNumber: "gr-a", status: "active" },
      { id: "stu-b", workspaceSubdomain: TENANT, grNumber: "gr-b", status: "active" },
      { id: "stu-c", workspaceSubdomain: TENANT, grNumber: "gr-c", status: "active" },
      { id: "stu-d", workspaceSubdomain: TENANT, grNumber: "gr-d", status: "active" },
      { id: "stu-e", workspaceSubdomain: TENANT, grNumber: "gr-e", status: "active" },
      { id: "stu-f", workspaceSubdomain: TENANT, grNumber: "gr-f", status: "active" },
      { id: "stu-g", workspaceSubdomain: TENANT, grNumber: "gr-g", status: "active" },
    ]);
    await tx.tx
      .insert(sessions)
      .values({ id: SESSION, workspaceSubdomain: TENANT, name: "Integrity Session" });
    await tx.tx
      .insert(sessionClasses)
      .values({ id: CLASS, workspaceSubdomain: TENANT, sessionId: SESSION, name: "Class" });
    await tx.tx.insert(sessionClassSections).values([
      {
        id: SECTION_OPEN,
        workspaceSubdomain: TENANT,
        sessionId: SESSION,
        classId: CLASS,
        name: "Open",
        capacity: 10,
      },
      {
        id: SECTION_FULL,
        workspaceSubdomain: TENANT,
        sessionId: SESSION,
        classId: CLASS,
        name: "Full",
        capacity: 1,
      },
    ]);
    // The transfer target below is genuinely full: one seat, one occupant.
    await tx.tx.insert(enrollments).values({
      id: "enr-seed-occupant",
      workspaceSubdomain: TENANT,
      studentId: "stu-g",
      studentName: "Student G",
      sessionId: SESSION,
      sessionName: "Integrity Session",
      classId: CLASS,
      className: "Class",
      sectionId: SECTION_FULL,
      enrolledDate: "2026-01-01",
      status: "confirmed",
    });
    await tx.tx.insert(enrollments).values({
      id: "enr-seed-full",
      workspaceSubdomain: TENANT,
      studentId: "stu-b",
      studentName: "Student B",
      sessionId: SESSION,
      sessionName: "Integrity Session",
      classId: CLASS,
      className: "Class",
      sectionId: SECTION_OPEN,
      enrolledDate: "2026-01-01",
      status: "confirmed",
    });
    await tx.commit();
  } catch (error) {
    await tx.rollback().catch(() => undefined);
    throw error;
  }
}

function enrollmentRecord(id: string, studentId: string, sectionId: string | null) {
  return {
    id,
    studentId,
    studentName: studentId,
    sessionId: SESSION,
    sessionName: "Integrity Session",
    classId: CLASS,
    className: "Class",
    ...(sectionId ? { sectionId } : {}),
    enrolledDate: "2026-01-01",
    baseFee: 0,
    discountType: "none",
    discountLabel: "",
    discountPct: 0,
    discountAmt: 0,
    finalFee: 0,
    status: "pending" as const,
    invoiceId: null,
    paymentStatus: "none" as const,
    notes: "",
    timeline: [],
  };
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await seedFixtures();
});

afterAll(async () => {
  {
    const cleanup = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    try {
      await cleanup.tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
      await cleanup.tx.delete(enrollments).where(eq(enrollments.workspaceSubdomain, TENANT));
      await cleanup.tx
        .delete(sessionClassSections)
        .where(eq(sessionClassSections.workspaceSubdomain, TENANT));
      await cleanup.tx.delete(sessionClasses).where(eq(sessionClasses.workspaceSubdomain, TENANT));
      await cleanup.tx.delete(sessions).where(eq(sessions.workspaceSubdomain, TENANT));
      await cleanup.tx.delete(students).where(eq(students.workspaceSubdomain, TENANT));
      await cleanup.tx.delete(workspaces).where(eq(workspaces.subdomain, TENANT));
      await cleanup.commit();
    } catch {
      await cleanup.rollback().catch(() => undefined);
    }
  }
  await closeDatabase();
});

describe("enrollment integrity indexes (real Postgres)", () => {
  it("provisions every integrity index as valid on a migrated database", async () => {
    const expected = [
      "enrollments_live_student_session_uidx",
      "enrollments_section_roll_no_active_uidx",
      "enrollments_session_promoted_from_uidx",
      "enrollments_workspace_section_idx",
      "enrollments_seat_count_idx",
    ];
    const rows = await withTenant(TENANT, async (tx) =>
      tx.execute<{ name: string; valid: boolean; unique: boolean }>(sql`
        SELECT c.relname AS name, i.indisvalid AS valid, i.indisunique AS unique
          FROM pg_index i
          JOIN pg_class c ON c.oid = i.indexrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname IN (${sql.join(
           expected.map((name) => sql`${name}`),
           sql`, `,
         )})
      `),
    );
    const found = new Map(rows.rows.map((row) => [row.name, row]));
    for (const name of expected) {
      expect(found.get(name), `${name} must be provisioned`).toBeDefined();
      expect(found.get(name)?.valid, `${name} must be valid`).toBe(true);
    }
    expect(found.get("enrollments_live_student_session_uidx")?.unique).toBe(true);
  });

  it("rejects a second live enrollment for the same student and session", async () => {
    await saveEnrollment(TENANT, enrollmentRecord("enr-dup-1", "stu-a", SECTION_OPEN));

    await expect(
      saveEnrollment(TENANT, enrollmentRecord("enr-dup-2", "stu-a", SECTION_OPEN)),
    ).rejects.toMatchObject({ statusCode: 409 });

    const [{ count }] = (await withTenant(TENANT, async (tx) =>
      tx
        .select({ count: sql<number>`count(*)::int` })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.workspaceSubdomain, TENANT),
            eq(enrollments.studentId, "stu-a"),
            isNull(enrollments.deletedAt),
          ),
        ),
    )) as [{ count: number }];
    expect(Number(count)).toBe(1);

    // Releasing the seat (withdrawal) frees the pair for a new enrollment.
    await withTenant(TENANT, async (tx) =>
      tx
        .update(enrollments)
        .set({ status: "withdrawn" })
        .where(and(eq(enrollments.workspaceSubdomain, TENANT), eq(enrollments.id, "enr-dup-1"))),
    );
    await saveEnrollment(TENANT, enrollmentRecord("enr-dup-3", "stu-a", SECTION_OPEN));
  });

  it("serializes seat allocation so two concurrent writes cannot take the last seat", async () => {
    // A dedicated one-seat section keeps the race deterministic.
    await withTenant(TENANT, async (tx) =>
      tx.insert(sessionClassSections).values({
        id: "sec-one",
        workspaceSubdomain: TENANT,
        sessionId: SESSION,
        classId: CLASS,
        name: "One Seat",
        capacity: 1,
      }),
    );

    const [first, second] = await Promise.allSettled([
      saveEnrollment(TENANT, enrollmentRecord("enr-race-1", "stu-d", "sec-one")),
      saveEnrollment(TENANT, enrollmentRecord("enr-race-2", "stu-e", "sec-one")),
    ]);

    const fulfilled = [first, second].filter((result) => result.status === "fulfilled");
    const rejected = [first, second].filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(SeatCapacityError);

    const [{ count }] = (await withTenant(TENANT, async (tx) =>
      tx
        .select({ count: sql<number>`count(*)::int` })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.workspaceSubdomain, TENANT),
            eq(enrollments.sectionId, "sec-one"),
            isNull(enrollments.deletedAt),
          ),
        ),
    )) as [{ count: number }];
    expect(Number(count)).toBe(1);
  });

  it("refuses a transfer into a full section and writes no placement", async () => {
    const placementsBefore = await withTenant(TENANT, async (tx) =>
      tx
        .select({ id: enrollmentPlacements.id })
        .from(enrollmentPlacements)
        .where(eq(enrollmentPlacements.workspaceSubdomain, TENANT)),
    );

    await expect(
      applyEnrollmentTransfer(TENANT, {
        enrollmentId: "enr-seed-full",
        from: { classId: CLASS, sectionId: SECTION_OPEN },
        to: { classId: CLASS, className: "Class", sectionId: SECTION_FULL },
        fee: {
          baseFee: 0,
          discountType: "none",
          discountLabel: "",
          discountPct: 0,
          discountAmt: 0,
          finalFee: 0,
        },
        effectiveOn: "2026-02-01",
        reason: "test transfer",
        actor: { userId: "u-1", label: "Admin" },
      }),
    ).rejects.toBeInstanceOf(SeatCapacityError);

    const placementsAfter = await withTenant(TENANT, async (tx) =>
      tx
        .select({ id: enrollmentPlacements.id })
        .from(enrollmentPlacements)
        .where(eq(enrollmentPlacements.workspaceSubdomain, TENANT)),
    );
    expect(placementsAfter).toHaveLength(placementsBefore.length);
  });
});

describe("enrollment restore guards (real Postgres)", () => {
  it("bulk restore leaves cascade-archived rows trashed", async () => {
    const tx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    try {
      await tx.tx.insert(enrollments).values([
        {
          id: "enr-trash-plain",
          workspaceSubdomain: TENANT,
          studentId: "stu-c",
          studentName: "Student C",
          sessionId: SESSION,
          sessionName: "Integrity Session",
          classId: CLASS,
          className: "Class",
          sectionId: SECTION_OPEN,
          enrolledDate: "2026-01-01",
          status: "confirmed",
          deletedAt: new Date("2026-03-01T00:00:00Z"),
          deletedBy: "u-1",
          deletedWithCascade: false,
        },
        {
          id: "enr-trash-cascade",
          workspaceSubdomain: TENANT,
          studentId: "stu-c",
          studentName: "Student C",
          sessionId: SESSION,
          sessionName: "Integrity Session",
          classId: CLASS,
          className: "Class",
          sectionId: SECTION_OPEN,
          enrolledDate: "2026-01-01",
          status: "confirmed",
          deletedAt: new Date("2026-03-01T00:00:00Z"),
          deletedBy: "u-1",
          deletedWithCascade: true,
        },
      ]);
      await tx.commit();
    } catch (error) {
      await tx.rollback().catch(() => undefined);
      throw error;
    }

    const result = await bulkRestoreEnrollments(
      TENANT,
      ["enr-trash-plain", "enr-trash-cascade"],
      "u-1",
    );
    expect(result).toEqual({ succeeded: 1, failed: 1 });

    expect((await readEnrollmentRow("enr-trash-plain"))?.deletedAt).toBeNull();
    expect((await readEnrollmentRow("enr-trash-cascade"))?.deletedAt).not.toBeNull();
  });

  it("does not resurrect an enrollment whose session is still archived", async () => {
    const tx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    try {
      await tx.tx.insert(enrollments).values({
        id: "enr-orphan-a",
        workspaceSubdomain: TENANT,
        studentId: "stu-f",
        studentName: "Student F",
        sessionId: SESSION,
        sessionName: "Integrity Session",
        classId: CLASS,
        className: "Class",
        sectionId: SECTION_OPEN,
        enrolledDate: "2026-01-01",
        status: "confirmed",
      });
      await tx.commit();
    } catch (error) {
      await tx.rollback().catch(() => undefined);
      throw error;
    }

    // Archive the student (cascades its enrollment), then archive the session too.
    const cascadeTx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    try {
      await cascadeTx.tx
        .update(students)
        .set({ deletedAt: new Date("2026-03-02T00:00:00Z"), deletedBy: "u-1" })
        .where(and(eq(students.workspaceSubdomain, TENANT), eq(students.id, "stu-f")));
      await cascadeSoftDeleteEnrollmentsForStudents(
        cascadeTx.tx,
        TENANT,
        ["stu-f"],
        "u-1",
        "left",
        new Date("2026-03-02T00:00:00Z"),
      );
      await cascadeTx.commit();
    } catch (error) {
      await cascadeTx.rollback().catch(() => undefined);
      throw error;
    }
    await withTenant(TENANT, async (tx) =>
      tx
        .update(sessions)
        .set({ deletedAt: new Date("2026-03-03T00:00:00Z"), deletedBy: "u-1" })
        .where(and(eq(sessions.workspaceSubdomain, TENANT), eq(sessions.id, SESSION))),
    );

    const restoreTx = await beginLongLivedTenantTransaction(TENANT);
    try {
      await restoreTx.tx.execute(sql`SELECT set_config('app.include_deleted', 'true', true)`);
      await restoreCascadedEnrollmentsForStudents(
        restoreTx.tx,
        TENANT,
        ["stu-f"],
        "u-1",
        new Date("2026-03-04T00:00:00Z"),
      );
      await restoreTx.commit();
    } catch (error) {
      await restoreTx.rollback().catch(() => undefined);
      throw error;
    }

    expect((await readEnrollmentRow("enr-orphan-a"))?.deletedAt).not.toBeNull();
  });

  it("does not resurrect an enrollment whose student is still archived", async () => {
    const tx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    try {
      await tx.tx.insert(enrollments).values({
        id: "enr-orphan-b",
        workspaceSubdomain: TENANT,
        studentId: "stu-f",
        studentName: "Student F",
        sessionId: SESSION,
        sessionName: "Integrity Session",
        classId: CLASS,
        className: "Class",
        sectionId: SECTION_OPEN,
        enrolledDate: "2026-01-01",
        status: "confirmed",
        deletedAt: new Date("2026-03-01T00:00:00Z"),
        deletedBy: "u-1",
        deletedWithCascade: true,
      });
      await tx.tx
        .update(students)
        .set({ deletedAt: new Date("2026-03-02T00:00:00Z"), deletedBy: "u-1" })
        .where(and(eq(students.workspaceSubdomain, TENANT), eq(students.id, "stu-f")));
      await tx.commit();
    } catch (error) {
      await tx.rollback().catch(() => undefined);
      throw error;
    }

    // The session is the only archived parent being restored here.
    await restoreSessionWithCascade(TENANT, SESSION, "u-1");

    expect((await readEnrollmentRow("enr-orphan-b"))?.deletedAt).not.toBeNull();
  });
});
