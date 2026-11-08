import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { closeDatabase, beginLongLivedTenantTransaction } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import {
  attendance,
  workspaces,
  students,
  sessions,
  sessionClasses,
  sessionClassSections,
} from "../../db/schema.js";
import type { AttendanceRecord } from "@mms/shared";
import {
  bulkSaveAttendanceRecords,
  listAttendanceRecordsByWorkspace,
} from "../../db/repositories/attendanceRepository.js";
import {
  bulkRestoreAttendanceRecords,
  bulkSoftDeleteAttendanceRecords,
} from "../../db/repositories/attendanceRepositoryTrash.js";
import { ConflictError } from "../../lib/httpErrors.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

/**
 * Real-Postgres regression suite for the Attendance persistence invariants
 * (docs/attendance-schema-persistence-audit-2026-11-08.md):
 *   - the business key, not the surrogate id, is the `ON CONFLICT` arbiter;
 *   - one mark per (class, student, day) survives a soft-deleted duplicate;
 *   - `version` is an honest OCC token, so a stale save 409s instead of overwriting;
 *   - restores are attributable and never collide into a 500;
 *   - the status domain and the unique-index shape are enforced by the database.
 */

const TENANT = "att-integrity-test";
const SESSION = "ses-att-integrity";
const CLASS = "cls-att-integrity";
const SECTION = "sec-att-integrity";

const DAY = "2026-03-02";
const OTHER_DAY = "2026-03-03";

function mark(overrides: Partial<AttendanceRecord> = {}): AttendanceRecord {
  return {
    id: `att-${Math.random().toString(36).slice(2, 10)}`,
    classId: CLASS,
    studentId: "stu-att-1",
    studentName: "Student One",
    rollNo: "001",
    date: DAY,
    status: "present",
    timeIn: "",
    timeOut: "",
    notes: "",
    sectionId: SECTION,
    ...overrides,
  } as AttendanceRecord;
}

async function seedFixtures(): Promise<void> {
  const tx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
  try {
    await tx.tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.tx.delete(attendance).where(eq(attendance.workspaceSubdomain, TENANT));
    await tx.tx
      .delete(sessionClassSections)
      .where(eq(sessionClassSections.workspaceSubdomain, TENANT));
    await tx.tx.delete(sessionClasses).where(eq(sessionClasses.workspaceSubdomain, TENANT));
    await tx.tx.delete(sessions).where(eq(sessions.workspaceSubdomain, TENANT));
    await tx.tx.delete(students).where(eq(students.workspaceSubdomain, TENANT));

    await tx.tx
      .insert(workspaces)
      .values({ id: `ws-${TENANT}`, subdomain: TENANT, madrasaName: "Attendance Integrity" })
      .onConflictDoNothing();
    await tx.tx.insert(students).values({
      id: "stu-att-1",
      workspaceSubdomain: TENANT,
      grNumber: "gr-att-1",
      status: "active",
    });
    await tx.tx
      .insert(sessions)
      .values({ id: SESSION, workspaceSubdomain: TENANT, name: "Attendance Session" });
    await tx.tx
      .insert(sessionClasses)
      .values({ id: CLASS, workspaceSubdomain: TENANT, sessionId: SESSION, name: "Class" });
    await tx.tx.insert(sessionClassSections).values({
      id: SECTION,
      workspaceSubdomain: TENANT,
      sessionId: SESSION,
      classId: CLASS,
      name: "A",
      capacity: 30,
    });
    await tx.commit();
  } catch (error) {
    await tx.rollback().catch(() => undefined);
    throw error;
  }
}

async function rowsFor(studentId = "stu-att-1") {
  return withTenant(TENANT, async (tx) => {
    await tx.execute(sql`SELECT set_config('app.include_deleted', 'true', true)`);
    return tx
      .select({
        id: attendance.id,
        date: attendance.date,
        status: attendance.status,
        version: attendance.version,
        deletedAt: attendance.deletedAt,
        restoredAt: attendance.restoredAt,
        restoredBy: attendance.restoredBy,
      })
      .from(attendance)
      .where(and(eq(attendance.workspaceSubdomain, TENANT), eq(attendance.studentId, studentId)))
      .orderBy(attendance.date, attendance.id);
  });
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await seedFixtures();
}, 120_000);

afterAll(async () => {
  const cleanup = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
  try {
    await cleanup.tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await cleanup.tx.delete(attendance).where(eq(attendance.workspaceSubdomain, TENANT));
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
  await closeDatabase();
});

describe("attendance schema invariants (real Postgres)", () => {
  it("keeps one mark per class, student and day as the partial unique arbiter", async () => {
    const result = await withTenant(TENANT, async (tx) =>
      tx.execute<{ indexdef: string }>(sql`
        SELECT indexdef FROM pg_indexes
         WHERE schemaname = 'public'
           AND indexname = 'attendance_workspace_class_student_date_on_uidx'
      `),
    );
    const indexdef = result.rows[0]?.indexdef ?? "";
    expect(indexdef).toContain("UNIQUE INDEX");
    expect(indexdef).toContain("workspace_subdomain");
    expect(indexdef).toContain("class_id");
    expect(indexdef).toContain("student_id");
    expect(indexdef).toContain("date_on");
    // The section is a stamped attribute, not part of the key: including it would allow a second
    // mark for the same day after a mid-term section transfer.
    expect(indexdef).not.toContain("section_id");
    expect(indexdef).toContain("deleted_at IS NULL");
  });

  it("enforces the attendance_status_check domain", async () => {
    const constraint = await withTenant(TENANT, async (tx) =>
      tx.execute<{ conname: string }>(sql`
        SELECT conname FROM pg_constraint
         WHERE conrelid = 'attendance'::regclass AND conname = 'attendance_status_check'
      `),
    );
    expect(constraint.rows[0]?.conname).toBe("attendance_status_check");

    await expect(
      withTenant(TENANT, async (tx) => {
        await tx.insert(attendance).values({
          id: "att-bad-status",
          workspaceSubdomain: TENANT,
          classId: CLASS,
          studentId: "stu-att-1",
          date: OTHER_DAY,
          status: "Present",
        });
      }),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("requires version and defaults it to 1", async () => {
    const column = await withTenant(TENANT, async (tx) =>
      tx.execute<{ column_default: string | null; is_nullable: string }>(sql`
        SELECT column_default, is_nullable FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'attendance' AND column_name = 'version'
      `),
    );
    expect(column.rows[0]?.is_nullable).toBe("NO");
    expect(column.rows[0]?.column_default).toContain("1");
  });
});

describe("attendance upsert arbitration (real Postgres)", () => {
  it("updates the existing row when the same day is saved under a new id", async () => {
    const first = mark({ id: "att-upsert-original", status: "absent" });
    const [persisted] = await bulkSaveAttendanceRecords(TENANT, [first]);
    expect(persisted?.id).toBe("att-upsert-original");

    // A second device (or a regenerated client id) must not create a duplicate or raise 23505.
    const resent = mark({ id: "att-upsert-second-device", status: "late" });
    const [updated] = await bulkSaveAttendanceRecords(TENANT, [resent]);

    expect(updated?.id).toBe("att-upsert-original");
    expect(updated?.status).toBe("late");
    expect(updated?.version).toBe(2);

    const rows = await rowsFor();
    expect(rows.filter((row) => row.date === DAY)).toHaveLength(1);
  });

  it("collapses a batch that repeats the same business key", async () => {
    const [persisted] = await bulkSaveAttendanceRecords(TENANT, [
      mark({ id: "att-batch-a", date: OTHER_DAY, status: "present" }),
      mark({ id: "att-batch-b", date: OTHER_DAY, status: "excused" }),
    ]);

    // Last write for the key wins; Postgres never sees a duplicated conflict target (21000).
    expect(persisted?.status).toBe("excused");
    const rows = (await rowsFor()).filter((row) => row.date === OTHER_DAY);
    expect(rows).toHaveLength(1);
  });

  it("refuses a stale OCC token with 409 instead of overwriting", async () => {
    const [current] = await bulkSaveAttendanceRecords(TENANT, [
      mark({ id: "att-occ", date: "2026-03-04", status: "present" }),
    ]);
    expect(current?.version).toBe(1);

    const staleSave = bulkSaveAttendanceRecords(TENANT, [
      mark({ id: "att-occ", date: "2026-03-04", status: "absent", version: 99 }),
    ]);

    await expect(staleSave).rejects.toMatchObject({
      statusCode: 409,
      type: "stale_write",
    });
    await expect(staleSave).rejects.toBeInstanceOf(ConflictError);

    const rows = (await rowsFor()).filter((row) => row.date === "2026-03-04");
    expect(rows[0]?.status).toBe("present");
    expect(rows[0]?.version).toBe(1);
  });

  it("accepts a matching OCC token and advances the version", async () => {
    const [next] = await bulkSaveAttendanceRecords(TENANT, [
      mark({ id: "att-occ", date: "2026-03-04", status: "late", version: 1 }),
    ]);

    expect(next?.status).toBe("late");
    expect(next?.version).toBe(2);
  });
});

describe("attendance soft-delete lifecycle (real Postgres)", () => {
  it("stamps restore provenance and advances the version", async () => {
    await bulkSaveAttendanceRecords(TENANT, [
      mark({ id: "att-restore", date: "2026-03-05", status: "present" }),
    ]);
    await bulkSoftDeleteAttendanceRecords(TENANT, ["att-restore"], "user-1", "mistake");

    const [trashed] = (await rowsFor()).filter((row) => row.id === "att-restore");
    expect(trashed?.deletedAt).not.toBeNull();
    expect(trashed?.version).toBe(2);

    await expect(bulkRestoreAttendanceRecords(TENANT, ["att-restore"], "user-2")).resolves.toEqual({
      succeeded: 1,
      failed: 0,
    });

    const [restored] = (await rowsFor()).filter((row) => row.id === "att-restore");
    expect(restored?.deletedAt).toBeNull();
    expect(restored?.restoredAt).not.toBeNull();
    expect(restored?.restoredBy).toBe("user-2");
    expect(restored?.version).toBe(3);
  });

  it("does not turn a restore collision into a 500", async () => {
    await bulkSaveAttendanceRecords(TENANT, [
      mark({ id: "att-collide", date: "2026-03-06", status: "absent" }),
    ]);
    await bulkSoftDeleteAttendanceRecords(TENANT, ["att-collide"], "user-1", "correction");
    // A fresh mark now occupies the same business key while the old one sits in the trash.
    await bulkSaveAttendanceRecords(TENANT, [
      mark({ id: "att-collide-live", date: "2026-03-06", status: "present" }),
    ]);

    await expect(bulkRestoreAttendanceRecords(TENANT, ["att-collide"], "user-2")).resolves.toEqual({
      succeeded: 0,
      failed: 1,
    });

    const live = (await rowsFor()).filter((row) => row.date === "2026-03-06");
    expect(live).toHaveLength(2);
    expect(live.filter((row) => row.deletedAt === null)).toHaveLength(1);
  });

  it("returns archived rows with their restore evidence in the workspace list", async () => {
    const records = await listAttendanceRecordsByWorkspace(TENANT, { includeDeleted: true });
    const restored = records.find((record) => record.id === "att-restore");
    expect(restored?.restoredBy).toBe("user-2");
    expect(restored?.restoredAt).toBeTruthy();
  });
});
