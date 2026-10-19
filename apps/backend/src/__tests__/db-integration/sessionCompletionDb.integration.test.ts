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
    await tx
      .insert(exams)
      .values({ id: "final", workspaceSubdomain: TENANT, name: "Final", passingMarks: 50 });
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
    const rows = await run(() => completion.evaluate(TENANT, "course"));

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
    // Act
    const first = await run(() =>
      completion.issueCertificates(TENANT, "course", { enrollmentIds: [] }),
    );
    const second = await run(() =>
      completion.issueCertificates(TENANT, "course", { enrollmentIds: [] }),
    );

    // Assert
    const issuedTo = first.rows
      .filter((row) => row.certificateIssuedAt)
      .map((row) => row.studentId);
    expect(first.issued).toHaveLength(1);
    expect(issuedTo).toEqual(["s1"]);
    expect(second.issued).toEqual([]);
  });
});
