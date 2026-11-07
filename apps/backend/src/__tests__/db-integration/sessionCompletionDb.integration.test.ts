import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { SessionSchema, WEEKDAY_NAMES } from "@mms/shared";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import {
  attendance,
  examClasses,
  examResults,
  exams,
  students,
  workspaces,
} from "../../db/schema.js";
import { saveSession } from "../../db/repositories/sessionRepositoryPersist.js";
import { bulkEnrollStudentsIntoClass } from "../../enrollments/use-cases/enrollmentBulkEnroll.js";
import { sessionCompletionUseCases as completion } from "../../sessions/use-cases/sessionCompletionUseCases.js";
import { transitionSession } from "../../sessions/use-cases/sessionTransitionService.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TENANT = "session-completion-test";
const run = <T>(fn: () => Promise<T>) => runWithTenant(TENANT, fn);
const DAYS = ["2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05"];

async function purgeTenant(): Promise<void> {
  await withTenant(TENANT, async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.delete(workspaces).where(eq(workspaces.subdomain, TENANT));
  });
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await purgeTenant();
  await withTenant(TENANT, async (tx) => {
    await tx
      .insert(workspaces)
      .values({ id: TENANT, subdomain: TENANT, madrasaName: "Completion", enabled: true });
    await tx.insert(students).values(
      ["s1", "s2"].map((id) => ({
        id,
        workspaceSubdomain: TENANT,
        grNumber: `gr-${id}`,
        status: "active",
      })),
    );
  });
  await saveSession(
    TENANT,
    SessionSchema.parse({
      id: "course",
      name: "Tajweed Course",
      status: "in_progress",
      startDate: "2026-03-01",
      endDate: "2026-03-31",
      workingDays: [...WEEKDAY_NAMES],
      minAttendancePct: 75,
      requiresExamPass: true,
      classes: [{ id: "batch", name: "Batch A", sections: [{ id: "batch-a", name: "A" }] }],
    }),
  );
  await run(() =>
    bulkEnrollStudentsIntoClass(TENANT, {
      studentIds: ["s1", "s2"],
      sessionId: "course",
      classId: "batch",
      mode: "add",
    }),
  );
  await withTenant(TENANT, async (tx) => {
    await tx.insert(attendance).values(
      DAYS.flatMap((day, index) => [
        {
          id: `a1-${day}`,
          workspaceSubdomain: TENANT,
          classId: "batch",
          studentId: "s1",
          date: day,
        },
        {
          id: `a2-${day}`,
          workspaceSubdomain: TENANT,
          classId: "batch",
          studentId: "s2",
          date: day,
          status: index < 2 ? "present" : "absent",
        },
      ]),
    );
    await tx.insert(exams).values({
      id: "final",
      workspaceSubdomain: TENANT,
      name: "Final",
      passingMarks: 50,
      // Grade finalisation gate: only completed, finalized exams count toward completion.
      status: "completed",
      resultsFinalizedAt: new Date("2026-03-30T00:00:00Z"),
    });
    await tx
      .insert(examClasses)
      .values({ workspaceSubdomain: TENANT, examId: "final", classId: "batch" });
    await tx.insert(examResults).values([
      { id: "r1", workspaceSubdomain: TENANT, examId: "final", studentId: "s1", marksObtained: 80 },
      { id: "r2", workspaceSubdomain: TENANT, examId: "final", studentId: "s2", marksObtained: 30 },
    ]);
  });
});

afterAll(async () => {
  try {
    await purgeTenant();
  } finally {
    await closeDatabase();
  }
});

describe("short-course completion (real Postgres)", () => {
  it("given attendance and exam results, should evaluate completion against the criteria", async () => {
    // Act
    const rows = await run(() =>
      completion.evaluate(
        TENANT,
        "course",
        // Attendance is marked for 4 of the month's instructional days; acknowledge the rest and
        // exercise the audited override path (the gate is asserted in its own test).
        { acknowledge: ["attendance_unfinalized"], reason: "Test fixture marks only four days" },
        { canOverride: true },
      ),
    );

    // Assert
    const byStudent = Object.fromEntries(rows.map((row) => [row.studentId, row]));
    expect(byStudent.s1).toMatchObject({
      attendancePct: 100,
      examsPassed: true,
      status: "completed",
      shortfalls: [],
    });
    expect(byStudent.s1?.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(byStudent.s2).toMatchObject({
      attendancePct: 50,
      examsPassed: false,
      status: "not_completed",
      shortfalls: ["attendance_below", "exam_not_passed"],
      completedAt: null,
    });
  });

  it("given completed enrollments, should issue each certificate once", async () => {
    // Arrange — certificates are only issued for a session that has been completed.
    await run(() => transitionSession(TENANT, "course", { to: "completed" }));

    // Act
    const first = await run(() =>
      completion.issueCertificates(
        TENANT,
        "course",
        {
          enrollmentIds: [],
          acknowledge: ["attendance_unfinalized"],
          reason: "Test fixture marks only four days",
        },
        { canOverride: true },
      ),
    );
    const second = await run(() =>
      completion.issueCertificates(
        TENANT,
        "course",
        {
          enrollmentIds: [],
          acknowledge: ["attendance_unfinalized"],
          reason: "Test fixture marks only four days",
        },
        { canOverride: true },
      ),
    );

    // Assert
    const issuedTo = first.rows
      .filter((row) => row.certificateIssuedAt)
      .map((row) => row.studentId);
    expect(first.issued).toHaveLength(1);
    expect(issuedTo).toEqual(["s1"]);
    expect(second.issued).toEqual([]);
  });

  it("should refuse completion while attendance is unmarked and exams are unfinalized", async () => {
    // Arrange — a session whose only marked day is one of many instructional days, with an
    // exam that has not been finalized.
    await saveSession(
      TENANT,
      SessionSchema.parse({
        id: "gated",
        name: "Gated Course",
        status: "in_progress",
        startDate: "2026-03-01",
        endDate: "2026-03-31",
        workingDays: [...WEEKDAY_NAMES],
        minAttendancePct: 75,
        requiresExamPass: true,
        classes: [{ id: "gated-class", name: "Gated", sections: [{ id: "gated-a", name: "A" }] }],
      }),
    );
    await run(() =>
      bulkEnrollStudentsIntoClass(TENANT, {
        studentIds: ["s1"],
        sessionId: "gated",
        classId: "gated-class",
        mode: "add",
      }),
    );
    await withTenant(TENANT, async (tx) => {
      await tx.insert(attendance).values({
        id: "gated-a1",
        workspaceSubdomain: TENANT,
        classId: "gated-class",
        studentId: "s1",
        date: "2026-03-02",
        status: "present",
      });
      await tx.insert(exams).values({
        id: "gated-final",
        workspaceSubdomain: TENANT,
        name: "Gated Final",
        passingMarks: 50,
        status: "ongoing",
      });
      await tx
        .insert(examClasses)
        .values({ workspaceSubdomain: TENANT, examId: "gated-final", classId: "gated-class" });
    });

    // Act / Assert — no acknowledgement, no override: both gates block.
    await expect(run(() => completion.evaluate(TENANT, "gated"))).rejects.toMatchObject({
      violations: expect.arrayContaining(["attendance_unfinalized", "exams_unfinalized"]),
    });
  });
});
