import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, sql } from "drizzle-orm";
import { closeDatabase, beginLongLivedTenantTransaction } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import {
  attendance,
  workspaces,
  students,
  sessions,
  sessionClasses,
  sessionClassSections,
} from "../../db/schema.js";
import type { AttendanceRecord, User } from "@mms/shared";
import { bulkSaveAttendanceRecords } from "../../db/repositories/attendanceRepository.js";
import {
  reopenSubmittedAttendanceDay,
  submitAttendanceDay,
} from "../../attendance/use-cases/attendanceLeaveUseCases.js";
import { assertAttendanceWriteAllowed } from "../../attendance/use-cases/attendancePolicyGuard.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

/**
 * `lockAfterSubmit` (real Postgres) — migration 0219.
 *
 * The preference was configurable with nothing durable behind it: the grid kept "submitted" in React
 * state. This suite proves the submitted day now blocks writes until an admin reopens it.
 */

const TENANT = "att-submission-test";
const SESSION = "ses-att-submission";
const CLASS = "cls-att-submission";
const SECTION = "sec-att-submission";

const TEACHER = { id: "u-sub-teacher", role: "teacher" } as unknown as User;
const ADMIN = { id: "u-sub-admin", role: "admin" } as unknown as User;

const DAY = "2026-06-02";

function mark(overrides: Partial<AttendanceRecord> = {}): AttendanceRecord {
  return {
    id: `att-sub-${Math.random().toString(36).slice(2, 8)}`,
    classId: CLASS,
    studentId: "stu-sub-1",
    studentName: "Student Submission",
    rollNo: "001",
    date: DAY,
    status: "present",
    timeIn: "07:00",
    timeOut: "08:30",
    notes: "",
    sectionId: SECTION,
    ...overrides,
  } as AttendanceRecord;
}

/** Day-scoped write attempt through the real policy guard (cut-off disabled by an early clock). */
async function writeAttempt(actor: User, rows: AttendanceRecord[] = [mark()]) {
  return assertAttendanceWriteAllowed({
    tenant: TENANT,
    actor,
    rows,
    // 06:00 on the attendance day: inside the 09:30 cut-off, so only the submitted-day lock can
    // reject this write.
    now: new Date(`${DAY}T06:00:00.000Z`),
  });
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
    await tx.tx.execute(
      sql`DELETE FROM attendance_day_submissions WHERE workspace_subdomain = ${TENANT}`,
    );

    await tx.tx
      .insert(workspaces)
      .values({ id: `ws-${TENANT}`, subdomain: TENANT, madrasaName: "Attendance Submission" })
      .onConflictDoNothing();
    await tx.tx.insert(students).values({
      id: "stu-sub-1",
      workspaceSubdomain: TENANT,
      grNumber: "gr-sub-1",
      status: "active",
    });
    await tx.tx
      .insert(sessions)
      .values({ id: SESSION, workspaceSubdomain: TENANT, name: "Submission Session" });
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
    await cleanup.tx.execute(
      sql`DELETE FROM attendance_day_submissions WHERE workspace_subdomain = ${TENANT}`,
    );
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

describe("attendance day submission (real Postgres)", () => {
  it("lets a teacher write before the day is submitted", async () => {
    await bulkSaveAttendanceRecords(TENANT, [mark({ id: "att-sub-before" })]);
    await expect(writeAttempt(TEACHER)).resolves.toBeUndefined();
  });

  it("locks the day on submit and refuses teacher writes afterwards", async () => {
    const { submission, alreadySubmitted } = await submitAttendanceDay(TENANT, {
      classId: CLASS,
      date: DAY,
      submittedBy: TEACHER.id,
    });
    expect(alreadySubmitted).toBe(false);
    expect(submission.locked).toBe(true);
    expect(submission.submittedBy).toBe(TEACHER.id);

    await expect(writeAttempt(TEACHER)).rejects.toMatchObject({
      statusCode: 409,
      type: "attendance_day_locked",
    });
  });

  it("still lets an administrator write after submit (override)", async () => {
    await expect(writeAttempt(ADMIN)).resolves.toBeUndefined();
  });

  it("is idempotent on a second submit", async () => {
    const first = await submitAttendanceDay(TENANT, {
      classId: CLASS,
      date: DAY,
      submittedBy: TEACHER.id,
    });
    expect(first.alreadySubmitted).toBe(true);
  });

  it("reopens the day and lets the teacher write again", async () => {
    const reopened = await reopenSubmittedAttendanceDay(TENANT, {
      classId: CLASS,
      date: DAY,
      reopenedBy: ADMIN.id,
      reason: "Wrong student marked absent",
    });
    expect(reopened.locked).toBe(false);
    expect(reopened.reopenReason).toBe("Wrong student marked absent");

    await expect(writeAttempt(TEACHER)).resolves.toBeUndefined();
  });

  it("locks again on re-submit after a reopen", async () => {
    const resubmitted = await submitAttendanceDay(TENANT, {
      classId: CLASS,
      date: DAY,
      submittedBy: TEACHER.id,
    });
    expect(resubmitted.alreadySubmitted).toBe(false);
    expect(resubmitted.submission.locked).toBe(true);
    expect(resubmitted.submission.reopenedAt).toBeNull();

    await expect(writeAttempt(TEACHER)).rejects.toMatchObject({ type: "attendance_day_locked" });
  });

  it("leaves another day of the same class editable", async () => {
    await expect(writeAttempt(TEACHER, [mark({ date: "2026-06-03" })])).resolves.toBeUndefined();
  });

  it("reports a never-submitted day as a 404 when reopening", async () => {
    await expect(
      reopenSubmittedAttendanceDay(TENANT, {
        classId: CLASS,
        date: "2026-06-09",
        reopenedBy: ADMIN.id,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
