import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { and, eq, isNull, sql } from "drizzle-orm";
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
  saveAttendanceRecordById,
} from "../../db/repositories/attendanceRepository.js";
import { ConflictError } from "../../lib/httpErrors.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

/**
 * Moving a mark to another day/class (real Postgres).
 *
 * `PATCH /api/attendance/:id` may change `date`/`classId` — the route re-checks teacher scope and
 * instructional days for the new day, so the product intends it. The natural-key upsert cannot
 * express it (same surrogate id, new business key → primary-key collision), which is why the
 * repository gained a by-id update. This suite pins that behaviour at the database.
 */

const TENANT = "att-move-test";
const SESSION = "ses-att-move";
const CLASS = "cls-att-move";
const SECTION = "sec-att-move";

function mark(overrides: Partial<AttendanceRecord> = {}): AttendanceRecord {
  return {
    id: `att-move-${Math.random().toString(36).slice(2, 8)}`,
    classId: CLASS,
    studentId: "stu-move-1",
    studentName: "Student Move",
    rollNo: "001",
    date: "2026-05-04",
    status: "present",
    timeIn: "07:00",
    timeOut: "08:30",
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
      .values({ id: `ws-${TENANT}`, subdomain: TENANT, madrasaName: "Attendance Move" })
      .onConflictDoNothing();
    await tx.tx.insert(students).values({
      id: "stu-move-1",
      workspaceSubdomain: TENANT,
      grNumber: "gr-move-1",
      status: "active",
    });
    await tx.tx
      .insert(sessions)
      .values({ id: SESSION, workspaceSubdomain: TENANT, name: "Move Session" });
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

async function liveMarks() {
  return withTenant(TENANT, (tx) =>
    tx
      .select({ id: attendance.id, date: attendance.date, version: attendance.version })
      .from(attendance)
      .where(and(eq(attendance.workspaceSubdomain, TENANT), isNull(attendance.deletedAt)))
      .orderBy(attendance.date),
  );
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

describe("moving an attendance mark (real Postgres)", () => {
  it("moves the same row when the day changes", async () => {
    const [created] = await bulkSaveAttendanceRecords(TENANT, [
      mark({ id: "att-move-original", date: "2026-05-04" }),
    ]);
    expect(created?.date).toBe("2026-05-04");

    const moved = await saveAttendanceRecordById(TENANT, {
      ...created!,
      date: "2026-05-05",
      version: created!.version,
    });

    expect(moved?.id).toBe("att-move-original");
    expect(moved?.date).toBe("2026-05-05");
    expect(moved?.version).toBe(2);

    const rows = await liveMarks();
    expect(rows.filter((row) => row.id === "att-move-original")).toHaveLength(1);
    expect(rows.some((row) => row.date === "2026-05-04")).toBe(false);
  });

  it("refuses to move a mark onto a day that already has one", async () => {
    await bulkSaveAttendanceRecords(TENANT, [mark({ id: "att-move-target", date: "2026-05-06" })]);
    const [source] = await bulkSaveAttendanceRecords(TENANT, [
      mark({ id: "att-move-source", date: "2026-05-07" }),
    ]);

    await expect(
      saveAttendanceRecordById(TENANT, {
        ...source!,
        date: "2026-05-06",
        version: source!.version,
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("refuses a move with a stale OCC token", async () => {
    const [row] = await bulkSaveAttendanceRecords(TENANT, [
      mark({ id: "att-move-occ", date: "2026-05-08" }),
    ]);

    await expect(
      saveAttendanceRecordById(TENANT, { ...row!, date: "2026-05-09", version: 99 }),
    ).rejects.toMatchObject({ statusCode: 409, type: "stale_write" });

    const rows = await liveMarks();
    expect(rows.find((entry) => entry.id === "att-move-occ")?.date).toBe("2026-05-08");
  });

  it("returns null for a row that is not live", async () => {
    const [row] = await bulkSaveAttendanceRecords(TENANT, [
      mark({ id: "att-move-gone", date: "2026-05-10" }),
    ]);
    await withTenant(TENANT, (tx) =>
      tx
        .update(attendance)
        .set({ deletedAt: new Date() })
        .where(and(eq(attendance.workspaceSubdomain, TENANT), eq(attendance.id, row!.id))),
    );

    await expect(
      saveAttendanceRecordById(TENANT, { ...row!, date: "2026-05-11", version: row!.version }),
    ).resolves.toBeNull();
  });
});
