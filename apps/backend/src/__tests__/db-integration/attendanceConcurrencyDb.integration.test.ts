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
 * Concurrent roster marking (real Postgres).
 *
 * Two staff members saving the same grid in different orders used to take `ON CONFLICT` row locks in
 * opposite order, which is a deadlock (`40P01`). The repository now sorts by business key, so the
 * interleavings below must converge — and a mark saved twice under different ids must stay one row.
 */

const TENANT = "att-concurrency-test";
const SESSION = "ses-att-concurrency";
const CLASS = "cls-att-concurrency";
const SECTION = "sec-att-concurrency";
const DAY = "2026-04-01";
const STUDENTS = ["stu-c-1", "stu-c-2", "stu-c-3", "stu-c-4", "stu-c-5", "stu-c-6"];

function mark(studentId: string, id: string, status: AttendanceRecord["status"]): AttendanceRecord {
  return {
    id,
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
  } as AttendanceRecord;
}

async function resetMarks(): Promise<void> {
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
      .values({ id: `ws-${TENANT}`, subdomain: TENANT, madrasaName: "Attendance Concurrency" })
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
      .values({ id: SESSION, workspaceSubdomain: TENANT, name: "Concurrency Session" });
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

async function liveMarkCount(): Promise<number> {
  const rows = await withTenant(TENANT, async (tx) =>
    tx
      .select({ id: attendance.id })
      .from(attendance)
      .where(and(eq(attendance.workspaceSubdomain, TENANT), eq(attendance.date, DAY))),
  );
  return rows.filter(Boolean).length;
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

describe("attendance concurrent marking (real Postgres)", () => {
  it("does not deadlock when two staff save the same roster in opposite orders", async () => {
    await resetMarks();
    // Two independent id sets for the same business keys: whichever lands second must update the
    // row the first one created, not insert a competitor or fail with 23505.
    const forward = STUDENTS.map((studentId, index) =>
      mark(studentId, `att-fwd-${index}`, "present"),
    );
    const reverse = [...STUDENTS]
      .reverse()
      .map((studentId, index) => mark(studentId, `att-rev-${index}`, "late"));

    await expect(
      Promise.all([
        bulkSaveAttendanceRecords(TENANT, forward),
        bulkSaveAttendanceRecords(TENANT, reverse),
      ]),
    ).resolves.toHaveLength(2);

    expect(await liveMarkCount()).toBe(STUDENTS.length);
  });

  it("keeps exactly one row per student and day across repeated concurrent saves", async () => {
    await resetMarks();
    const batches = [0, 1, 2].map((round) =>
      STUDENTS.map((studentId, index) =>
        mark(studentId, `att-round-${round}-${index}`, round % 2 === 0 ? "present" : "absent"),
      ),
    );

    await Promise.all(batches.map((batch) => bulkSaveAttendanceRecords(TENANT, batch)));

    expect(await liveMarkCount()).toBe(STUDENTS.length);
  });
});
