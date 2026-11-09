import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { closeDatabase, beginLongLivedTenantTransaction } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import {
  attendance,
  attendanceAbsenceAlerts,
  attendanceLeaves,
  enrollments,
  examClasses,
  exams,
  examResults,
  sessionClassSections,
  sessionClasses,
  sessions,
  students,
  workspaces,
} from "../../db/schema.js";
import type { User } from "@mms/shared";
import { runWithTenant } from "../../lib/tenantContext.js";
import { attendanceExcuseUseCases } from "../../attendance/use-cases/attendanceExcuseUseCases.js";
import { scanAbsenceStreaks } from "../../attendance/use-cases/attendanceEscalationUseCases.js";
import { listAbsenceAlerts } from "../../db/repositories/attendanceEscalationRepository.js";
import {
  loadExamEligibility,
  setExamAttendanceGate,
} from "../../db/repositories/examEligibilityRepository.js";
import { setExamResultsFinalized } from "../../db/repositories/examClassMembershipRepository.js";
import { assertExamResultsEligible } from "../../examinations/use-cases/examEligibilityGate.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

/**
 * The three specialised attendance subsystems against real PostgreSQL: the excuse lifecycle with its
 * retroactive mark sync, the chronic-absence scan, and the exam attendance gate + finalisation.
 */

const TENANT = "att-specialized-test";
const SESSION = "ses-spec";
const CLASS = "cls-spec";
const CLASS_OTHER = "cls-other";
const SECTION = "sec-spec";
const SECTION_OTHER = "sec-other";
const STUDENT = "stu-spec-1";
const STUDENT_2 = "stu-spec-2";
const EXAM = "exam-spec";

const ADMIN = { id: "u-spec-admin", role: "admin" } as unknown as User;

function markRow(studentId: string, date: string, status: string) {
  return {
    id: `att-${studentId}-${date}`,
    workspaceSubdomain: TENANT,
    classId: CLASS,
    studentId,
    studentName: studentId,
    rollNo: "",
    date,
    status,
    timeIn: status === "absent" ? "" : "07:00",
    timeOut: status === "absent" ? "" : "08:30",
    notes: "",
    sectionId: SECTION,
  };
}

async function purgeTenant(): Promise<void> {
  const tx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
  try {
    await tx.tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.tx.delete(attendance).where(eq(attendance.workspaceSubdomain, TENANT));
    await tx.tx.delete(attendanceLeaves).where(eq(attendanceLeaves.workspaceSubdomain, TENANT));
    await tx.tx
      .delete(attendanceAbsenceAlerts)
      .where(eq(attendanceAbsenceAlerts.workspaceSubdomain, TENANT));
    await tx.tx.delete(examResults).where(eq(examResults.workspaceSubdomain, TENANT));
    await tx.tx.delete(examClasses).where(eq(examClasses.workspaceSubdomain, TENANT));
    await tx.tx.delete(exams).where(eq(exams.workspaceSubdomain, TENANT));
    await tx.tx.delete(enrollments).where(eq(enrollments.workspaceSubdomain, TENANT));
    await tx.tx
      .delete(sessionClassSections)
      .where(eq(sessionClassSections.workspaceSubdomain, TENANT));
    await tx.tx.delete(sessionClasses).where(eq(sessionClasses.workspaceSubdomain, TENANT));
    await tx.tx.delete(sessions).where(eq(sessions.workspaceSubdomain, TENANT));
    await tx.tx.delete(students).where(eq(students.workspaceSubdomain, TENANT));
    await tx.commit();
  } catch (error) {
    await tx.rollback().catch(() => undefined);
    throw error;
  }
}

async function seedFixtures(): Promise<void> {
  await purgeTenant();
  const tx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
  try {
    await tx.tx
      .insert(workspaces)
      .values({ id: `ws-${TENANT}`, subdomain: TENANT, madrasaName: "Specialized Attendance" })
      .onConflictDoNothing();
    await tx.tx.insert(students).values([
      { id: STUDENT, workspaceSubdomain: TENANT, grNumber: "gr-spec-1", status: "active" },
      { id: STUDENT_2, workspaceSubdomain: TENANT, grNumber: "gr-spec-2", status: "active" },
    ]);
    await tx.tx.insert(sessions).values({
      id: SESSION,
      workspaceSubdomain: TENANT,
      name: "Spec Session",
      // 75 % completion threshold also acts as the exam's fallback gate.
      minAttendancePct: 75,
    });
    await tx.tx.insert(sessionClasses).values([
      { id: CLASS, workspaceSubdomain: TENANT, sessionId: SESSION, name: "Class" },
      { id: CLASS_OTHER, workspaceSubdomain: TENANT, sessionId: SESSION, name: "Other Class" },
    ]);
    await tx.tx.insert(sessionClassSections).values([
      {
        id: SECTION,
        workspaceSubdomain: TENANT,
        sessionId: SESSION,
        classId: CLASS,
        name: "A",
        capacity: 30,
      },
      {
        id: SECTION_OTHER,
        workspaceSubdomain: TENANT,
        sessionId: SESSION,
        classId: CLASS_OTHER,
        name: "B",
        capacity: 30,
      },
    ]);
    await tx.tx.insert(enrollments).values([
      {
        id: "enr-spec-1",
        workspaceSubdomain: TENANT,
        studentId: STUDENT,
        studentName: STUDENT,
        sessionId: SESSION,
        sessionName: "Spec Session",
        classId: CLASS,
        className: "Class",
        sectionId: SECTION,
        enrolledDate: "2026-01-01",
        startOn: "2026-01-01",
        status: "confirmed",
      },
      {
        id: "enr-spec-2",
        workspaceSubdomain: TENANT,
        studentId: STUDENT_2,
        studentName: STUDENT_2,
        sessionId: SESSION,
        sessionName: "Spec Session",
        classId: CLASS,
        className: "Class",
        sectionId: SECTION,
        enrolledDate: "2026-01-01",
        startOn: "2026-01-01",
        status: "confirmed",
      },
    ]);
    await tx.tx.insert(exams).values({
      id: EXAM,
      workspaceSubdomain: TENANT,
      name: "Midterm",
      totalMarks: 100,
      passingMarks: 50,
      date: "2026-03-10",
      status: "upcoming",
    });
    await tx.tx
      .insert(examClasses)
      .values({ workspaceSubdomain: TENANT, examId: EXAM, classId: CLASS });
    await tx.commit();
  } catch (error) {
    await tx.rollback().catch(() => undefined);
    throw error;
  }
}

async function seedMarks(rows: ReturnType<typeof markRow>[]): Promise<void> {
  await withTenant(TENANT, async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.delete(attendance).where(eq(attendance.workspaceSubdomain, TENANT));
    if (rows.length > 0) await tx.insert(attendance).values(rows);
  });
}

async function readMarks(studentId: string) {
  return withTenant(TENANT, (tx) =>
    tx
      .select({ date: attendance.date, status: attendance.status })
      .from(attendance)
      .where(and(eq(attendance.workspaceSubdomain, TENANT), eq(attendance.studentId, studentId)))
      .orderBy(attendance.date),
  );
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await seedFixtures();
}, 120_000);

afterAll(async () => {
  await purgeTenant();
  await closeDatabase();
});

describe("excuse lifecycle (real Postgres)", () => {
  it("approving a medical excuse converts the covered absences and leaves present marks alone", async () => {
    await seedMarks([
      markRow(STUDENT, "2026-03-02", "absent"),
      markRow(STUDENT, "2026-03-03", "absent"),
      markRow(STUDENT, "2026-03-04", "present"),
    ]);

    const created = await runWithTenant(TENANT, () =>
      attendanceExcuseUseCases.submitExcuse(
        {
          studentId: STUDENT,
          fromDate: "2026-03-02",
          toDate: "2026-03-03",
          reason: "Fever",
          leaveType: "medical",
          notes: "",
        } as never,
        ADMIN,
      ),
    );
    expect(created.status).toBe("pending");

    const decided = await runWithTenant(TENANT, () =>
      attendanceExcuseUseCases.reviewExcuse(created.id, { decision: "approve" }, ADMIN),
    );
    expect(decided.status).toBe("approved");
    expect(decided.reviewedBy).toBe("u-spec-admin");

    const marks = await readMarks(STUDENT);
    expect(marks).toEqual([
      { date: "2026-03-02", status: "excused" },
      { date: "2026-03-03", status: "excused" },
      { date: "2026-03-04", status: "present" },
    ]);
  });

  it("refuses a second decision on the same excuse", async () => {
    const leaves = await withTenant(TENANT, (tx) =>
      tx.select().from(attendanceLeaves).where(eq(attendanceLeaves.workspaceSubdomain, TENANT)),
    );
    const approved = leaves.find((row) => row.status === "approved");
    expect(approved).toBeDefined();

    await expect(
      runWithTenant(TENANT, () =>
        attendanceExcuseUseCases.reviewExcuse(approved!.id, { decision: "reject" }, ADMIN),
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("cancelling an approved leave keeps the marks it excused", async () => {
    const leaves = await withTenant(TENANT, (tx) =>
      tx.select().from(attendanceLeaves).where(eq(attendanceLeaves.workspaceSubdomain, TENANT)),
    );
    const approved = leaves.find((row) => row.status === "approved")!;

    const cancelled = await runWithTenant(TENANT, () =>
      attendanceExcuseUseCases.cancelExcuse(approved.id, { reason: "Returned early" }, ADMIN),
    );
    expect(cancelled.status).toBe("cancelled");

    const marks = await readMarks(STUDENT);
    expect(marks.filter((row) => row.status === "excused")).toHaveLength(2);
  });
});

describe("chronic absence scan (real Postgres)", () => {
  it("raises exactly one alert for a three-day unexcused streak", async () => {
    await withTenant(TENANT, async (tx) => {
      await tx
        .delete(attendanceAbsenceAlerts)
        .where(eq(attendanceAbsenceAlerts.workspaceSubdomain, TENANT));
    });
    await seedMarks([
      markRow(STUDENT, "2026-03-02", "absent"),
      markRow(STUDENT, "2026-03-03", "absent"),
      markRow(STUDENT, "2026-03-04", "absent"),
      markRow(STUDENT_2, "2026-03-02", "present"),
      markRow(STUDENT_2, "2026-03-03", "present"),
      markRow(STUDENT_2, "2026-03-04", "present"),
    ]);

    const first = await scanAbsenceStreaks(TENANT, { now: new Date("2026-03-05T00:00:00Z") });
    expect(first.alertsRaised).toBe(1);

    const alerts = await listAbsenceAlerts(TENANT, {});
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      studentId: STUDENT,
      streakStart: "2026-03-02",
      streakLength: 3,
      status: "open",
    });
    expect(alerts[0]?.notifiedAt).not.toBeNull();

    // Re-running must not raise or notify again.
    const second = await scanAbsenceStreaks(TENANT, { now: new Date("2026-03-05T00:00:00Z") });
    expect(second.alertsRaised).toBe(0);
    expect(second.alertsUpdated).toBe(1);
    expect(await listAbsenceAlerts(TENANT, {})).toHaveLength(1);
  });

  it("does not flag a streak broken by a present day", async () => {
    await withTenant(TENANT, async (tx) => {
      await tx
        .delete(attendanceAbsenceAlerts)
        .where(eq(attendanceAbsenceAlerts.workspaceSubdomain, TENANT));
    });
    await seedMarks([
      markRow(STUDENT, "2026-03-02", "absent"),
      markRow(STUDENT, "2026-03-03", "present"),
      markRow(STUDENT, "2026-03-04", "absent"),
    ]);

    const scan = await scanAbsenceStreaks(TENANT, { now: new Date("2026-03-05T00:00:00Z") });
    expect(scan.alertsRaised).toBe(0);
    expect(await listAbsenceAlerts(TENANT, {})).toHaveLength(0);
  });
});

describe("exam attendance gate (real Postgres)", () => {
  it("blocks a student below the session's minimum and clears at the threshold", async () => {
    await seedMarks([
      // 3 of 4 countable days present for STUDENT → 75 %
      markRow(STUDENT, "2026-03-02", "present"),
      markRow(STUDENT, "2026-03-03", "present"),
      markRow(STUDENT, "2026-03-04", "present"),
      markRow(STUDENT, "2026-03-05", "absent"),
      // 1 of 4 for STUDENT_2 → 25 %
      markRow(STUDENT_2, "2026-03-02", "present"),
      markRow(STUDENT_2, "2026-03-03", "absent"),
      markRow(STUDENT_2, "2026-03-04", "absent"),
      markRow(STUDENT_2, "2026-03-05", "absent"),
    ]);

    const view = await loadExamEligibility(TENANT, EXAM);
    expect(view.requiredPct).toBe(75);
    const byStudent = new Map(view.rows.map((row) => [row.studentId, row]));
    expect(byStudent.get(STUDENT)).toMatchObject({ state: "eligible", attendancePct: 75 });
    expect(byStudent.get(STUDENT_2)).toMatchObject({ state: "blocked" });
  });

  it("refuses result entry below the gate and accepts it after an audited override", async () => {
    const blocked = [
      {
        id: "res-1",
        workspaceSubdomain: TENANT,
        examId: EXAM,
        studentId: STUDENT_2,
        marksObtained: 60,
      },
    ] as never;

    await expect(
      runWithTenant(TENANT, () => assertExamResultsEligible(ADMIN, blocked)),
    ).rejects.toMatchObject({ statusCode: 409, type: "exam_eligibility_blocked" });

    const { grantEligibilityOverride } =
      await import("../../db/repositories/examEligibilityRepository.js");
    await grantEligibilityOverride(TENANT, {
      examId: EXAM,
      studentId: STUDENT_2,
      reason: "Medical leave approved late",
      grantedBy: "u-spec-admin",
    });

    await expect(
      runWithTenant(TENANT, () => assertExamResultsEligible(ADMIN, blocked)),
    ).resolves.toBeUndefined();
  });

  it("rejects marks above the exam total", async () => {
    const overMarks = [
      {
        id: "res-2",
        workspaceSubdomain: TENANT,
        examId: EXAM,
        studentId: STUDENT,
        marksObtained: 120,
      },
    ] as never;
    await expect(
      runWithTenant(TENANT, () => assertExamResultsEligible(ADMIN, overMarks)),
    ).rejects.toMatchObject({ statusCode: 400, type: "exam_marks_out_of_range" });
  });

  it("finalises results so completion can count the exam", async () => {
    const finalized = await setExamResultsFinalized(TENANT, {
      examId: EXAM,
      finalized: true,
      actorId: "u-spec-admin",
    });
    expect(finalized?.resultsFinalizedAt).toBeInstanceOf(Date);
    expect(finalized?.status).toBe("completed");

    const reopened = await setExamResultsFinalized(TENANT, {
      examId: EXAM,
      finalized: false,
      actorId: "u-spec-admin",
    });
    expect(reopened?.resultsFinalizedAt).toBeNull();
  });

  it("stores a per-exam gate that overrides the session threshold", async () => {
    await setExamAttendanceGate(TENANT, {
      examId: EXAM,
      minAttendancePct: 90,
      actorId: "u-spec-admin",
    });
    const view = await loadExamEligibility(TENANT, EXAM);
    expect(view.requiredPct).toBe(90);
    const byStudent = new Map(view.rows.map((row) => [row.studentId, row]));
    expect(byStudent.get(STUDENT)?.state).toBe("blocked");
  });
});

describe("marking matrix roster (real Postgres)", () => {
  it("returns every mark for the class/day and ignores other classes", async () => {
    const { listAttendanceRoster } =
      await import("../../db/repositories/attendanceRepositoryList.js");
    await seedMarks([
      markRow(STUDENT, "2026-03-02", "absent"),
      markRow(STUDENT_2, "2026-03-02", "present"),
      // A different class on the same day must not leak into the roster.
      {
        ...markRow(STUDENT, "2026-03-02", "late"),
        id: "att-other-class",
        classId: CLASS_OTHER,
        sectionId: SECTION_OTHER,
      },
    ]);

    const roster = await listAttendanceRoster(TENANT, {
      classId: CLASS,
      date: "2026-03-02",
    });
    expect(roster).toHaveLength(2);
    expect(roster.map((row) => row.studentId).sort()).toEqual([STUDENT, STUDENT_2]);
    // The grid needs the OCC token to echo on save.
    expect(roster.every((row) => typeof row.version === "number")).toBe(true);
  });

  it("does not depend on how many rows exist elsewhere in the tenant", async () => {
    const { listAttendanceRoster } =
      await import("../../db/repositories/attendanceRepositoryList.js");
    // 300 unrelated rows in another class would have pushed this day out of a capped collection.
    const noise = Array.from({ length: 300 }, (_, index) => {
      const day = new Date(Date.UTC(2025, 0, 1 + index)).toISOString().slice(0, 10);
      return {
        ...markRow(STUDENT, day, "present"),
        id: `att-noise-${index}`,
        classId: CLASS_OTHER,
        sectionId: SECTION_OTHER,
        date: day,
      };
    });
    await seedMarks([...noise, markRow(STUDENT, "2026-03-02", "absent")]);

    const roster = await listAttendanceRoster(TENANT, { classId: CLASS, date: "2026-03-02" });
    expect(roster).toHaveLength(1);
    expect(roster[0]?.status).toBe("absent");
  });

  it("rejects a batch with several invalid rows and writes nothing", async () => {
    const { assertAttendanceWriteAllowed } =
      await import("../../attendance/use-cases/attendancePolicyGuard.js");
    const before = await readMarks(STUDENT);

    await expect(
      runWithTenant(TENANT, () =>
        assertAttendanceWriteAllowed({
          tenant: TENANT,
          actor: ADMIN,
          rows: [
            markRow(STUDENT, "2026-03-02", "absent"),
            { ...markRow(STUDENT_2, "2026-03-02", "absent"), notes: "" },
          ].map((row) => ({ ...row, status: "late", timeIn: "", timeOut: "" })),
        }),
      ),
    ).rejects.toMatchObject({ type: "attendance_batch_rejected" });

    expect(await readMarks(STUDENT)).toEqual(before);
  });
});
