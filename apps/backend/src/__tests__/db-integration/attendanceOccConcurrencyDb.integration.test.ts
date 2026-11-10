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
import { bulkSaveAttendanceRecords } from "../../db/repositories/attendanceRepository.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

/**
 * Attendance OCC + atomicity under real concurrency.
 *
 * The deadlock suite proves the row locks are taken in a stable order. This suite proves the *token*:
 * two writers holding the same version cannot both win, a batch containing one stale row writes
 * nothing at all, and rapid sequential toggles advance the version monotonically.
 */

const TENANT = "att-occ-test";
const SESSION = "ses-att-occ";
const CLASS = "cls-att-occ";
const SECTION = "sec-att-occ";
const DAY = "2026-05-04";
const STUDENTS = ["stu-occ-1", "stu-occ-2"];

function mark(
  studentId: string,
  status: AttendanceRecord["status"],
  version?: number,
): AttendanceRecord {
  return {
    id: `att-occ-${studentId}-${DAY}`,
    classId: CLASS,
    studentId,
    studentName: studentId,
    rollNo: "",
    date: DAY,
    status,
    timeIn: "",
    timeOut: "",
    notes: "",
    sectionId: SECTION,
    ...(typeof version === "number" ? { version } : {}),
  } as AttendanceRecord;
}

async function purge(): Promise<void> {
  const tx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
  try {
    await tx.tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.tx.delete(attendance).where(eq(attendance.workspaceSubdomain, TENANT));
    await tx.commit();
  } catch (error) {
    await tx.rollback().catch(() => undefined);
    throw error;
  }
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
      .values({ id: `ws-${TENANT}`, subdomain: TENANT, madrasaName: "Attendance OCC" })
      .onConflictDoNothing();
    await tx.tx.insert(students).values(
      STUDENTS.map((studentId) => ({
        id: studentId,
        workspaceSubdomain: TENANT,
        grNumber: `gr-${studentId}`,
        status: "active",
      })),
    );
    await tx.tx
      .insert(sessions)
      .values({ id: SESSION, workspaceSubdomain: TENANT, name: "OCC Session" });
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

async function marksFor(studentId = STUDENTS[0]!) {
  return withTenant(TENANT, async (tx) => {
    const rows = await tx
      .select({
        id: attendance.id,
        status: attendance.status,
        version: attendance.version,
      })
      .from(attendance)
      .where(
        and(
          eq(attendance.workspaceSubdomain, TENANT),
          eq(attendance.studentId, studentId),
          eq(attendance.date, DAY),
        ),
      );
    return rows;
  });
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await seedFixtures();
}, 120_000);

afterAll(async () => {
  await purge();
  const cleanup = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
  try {
    await cleanup.tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
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

describe("attendance OCC under concurrency (real Postgres)", () => {
  it("lets exactly one writer win when two saves carry the same version", async () => {
    await purge();
    const [seeded] = await bulkSaveAttendanceRecords(TENANT, [mark(STUDENTS[0]!, "present")]);
    expect(seeded?.version).toBe(1);

    const outcomes = await Promise.allSettled([
      bulkSaveAttendanceRecords(TENANT, [mark(STUDENTS[0]!, "late", 1)]),
      bulkSaveAttendanceRecords(TENANT, [mark(STUDENTS[0]!, "absent", 1)]),
    ]);

    const fulfilled = outcomes.filter((outcome) => outcome.status === "fulfilled");
    const rejected = outcomes.filter(
      (outcome): outcome is PromiseRejectedResult => outcome.status === "rejected",
    );
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toMatchObject({ statusCode: 409, type: "stale_write" });

    const rows = await marksFor();
    expect(rows).toHaveLength(1);
    // The winner advanced the token exactly once; the loser never wrote.
    expect(rows[0]?.version).toBe(2);
  });

  it("writes nothing when one row of a mixed-token batch is stale", async () => {
    await purge();
    await bulkSaveAttendanceRecords(TENANT, [
      mark(STUDENTS[0]!, "present"),
      mark(STUDENTS[1]!, "present"),
    ]);

    // Row A carries the right token, row B a stale one: the batch must be all-or-nothing.
    await expect(
      bulkSaveAttendanceRecords(TENANT, [
        mark(STUDENTS[0]!, "late", 1),
        mark(STUDENTS[1]!, "absent", 99),
      ]),
    ).rejects.toMatchObject({ statusCode: 409, type: "stale_write" });

    const first = await marksFor(STUDENTS[0]!);
    const second = await marksFor(STUDENTS[1]!);
    expect(first[0]).toMatchObject({ status: "present", version: 1 });
    expect(second[0]).toMatchObject({ status: "present", version: 1 });
  });

  it("advances the version monotonically across rapid sequential toggles", async () => {
    await purge();
    const sequence: AttendanceRecord["status"][] = [
      "present",
      "absent",
      "late",
      "half_day",
      "present",
    ];

    let version: number | undefined;
    for (const [step, status] of sequence.entries()) {
      const [persisted] = await bulkSaveAttendanceRecords(TENANT, [
        mark(STUDENTS[0]!, status, version),
      ]);
      version = persisted?.version;
      expect(version).toBe(step + 1);
    }

    const rows = await marksFor();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "present", version: 5 });
  });

  it("keeps one row per student and day when both students are toggled concurrently", async () => {
    await purge();
    await bulkSaveAttendanceRecords(TENANT, [
      mark(STUDENTS[0]!, "present"),
      mark(STUDENTS[1]!, "present"),
    ]);

    await Promise.allSettled([
      bulkSaveAttendanceRecords(TENANT, [mark(STUDENTS[0]!, "late", 1)]),
      bulkSaveAttendanceRecords(TENANT, [mark(STUDENTS[1]!, "half_day", 1)]),
    ]);

    expect(await marksFor(STUDENTS[0]!)).toHaveLength(1);
    expect(await marksFor(STUDENTS[1]!)).toHaveLength(1);
  });
});
