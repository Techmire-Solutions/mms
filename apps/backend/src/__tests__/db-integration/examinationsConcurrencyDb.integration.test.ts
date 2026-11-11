import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ExamResult } from "@mms/shared";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { beginLongLivedTenantTransaction, closeDatabase } from "../../db/dbConnection.js";
import { withTenant } from "../../db/tenant-context.js";
import {
  auditTrailEvents,
  examClasses,
  examResults,
  exams,
  sessionClasses,
  sessions,
  students,
  workspaces,
} from "../../db/schema.js";
import {
  applyExamResultModeration,
  bulkSaveExamResults,
  saveExamResult,
} from "../../db/repositories/examinationResultsRepository.js";
import { setExamResultsFinalized } from "../../db/repositories/examClassMembershipRepository.js";
import { ConflictError } from "../../lib/httpErrors.js";
import { extractPgErrorCode, requireDatabaseConnection } from "./dbTestSupport.js";

/**
 * Real-Postgres concurrency suite for the exam marks path.
 *
 * Repeated by `scripts/ci/run-concurrency-suite.mjs`: the single OCC race in the integrity suite is
 * a one-shot; these cases prove the deterministic lock ordering, the publication CAS, and that a
 * moderation racing a marks save cannot produce a mixed row.
 */
const TENANT = "exam-concurrency-test";
const SESSION = "ses-exam-concurrency";
const CLASS = "cls-exam-concurrency";
const EXAM = "ex-exam-concurrency";
const STUDENT_1 = "stu-conc-1";
const STUDENT_2 = "stu-conc-2";

function mark(overrides: Partial<ExamResult> = {}): ExamResult {
  return {
    id: overrides.id ?? `er-${Math.random().toString(36).slice(2, 10)}`,
    examId: EXAM,
    studentId: overrides.studentId ?? STUDENT_1,
    marksObtained: overrides.marksObtained ?? 70,
    ...(overrides.version !== undefined ? { version: overrides.version } : {}),
  };
}

async function seedFixtures(): Promise<void> {
  const tx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
  try {
    await tx.tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.tx
      .insert(workspaces)
      .values({ id: `ws-${TENANT}`, subdomain: TENANT, madrasaName: "Exam Concurrency" })
      .onConflictDoNothing();
    await tx.tx.insert(students).values([
      { id: STUDENT_1, workspaceSubdomain: TENANT, grNumber: "gr-conc-1", status: "active" },
      { id: STUDENT_2, workspaceSubdomain: TENANT, grNumber: "gr-conc-2", status: "active" },
    ]);
    await tx.tx
      .insert(sessions)
      .values({ id: SESSION, workspaceSubdomain: TENANT, name: "Concurrency Session" });
    await tx.tx
      .insert(sessionClasses)
      .values({ id: CLASS, workspaceSubdomain: TENANT, sessionId: SESSION, name: "Class" });
    await tx.commit();
  } catch (error) {
    await tx.rollback().catch(() => undefined);
    throw error;
  }
}

async function resetExamState(): Promise<void> {
  await withTenant(TENANT, async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.delete(examResults).where(eq(examResults.workspaceSubdomain, TENANT));
    await tx.delete(examClasses).where(eq(examClasses.workspaceSubdomain, TENANT));
    await tx.delete(exams).where(eq(exams.workspaceSubdomain, TENANT));
    await tx.insert(exams).values({
      id: EXAM,
      workspaceSubdomain: TENANT,
      name: "Concurrency Exam",
      totalMarks: 100,
      passingMarks: 50,
      date: "2026-03-10",
      duration: 90,
      status: "ongoing",
      description: "",
    });
    await tx
      .insert(examClasses)
      .values({ workspaceSubdomain: TENANT, examId: EXAM, classId: CLASS });
  });
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await seedFixtures();
}, 120_000);

beforeEach(async () => {
  await resetExamState();
});

afterAll(async () => {
  const cleanup = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
  try {
    await cleanup.tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await cleanup.tx
      .delete(auditTrailEvents)
      .where(eq(auditTrailEvents.workspaceSubdomain, TENANT));
    await cleanup.tx.delete(examResults).where(eq(examResults.workspaceSubdomain, TENANT));
    await cleanup.tx.delete(examClasses).where(eq(examClasses.workspaceSubdomain, TENANT));
    await cleanup.tx.delete(exams).where(eq(exams.workspaceSubdomain, TENANT));
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

describe("exam marks concurrency", () => {
  it("saves disjoint batches concurrently without a deadlock", async () => {
    const outcomes = await Promise.allSettled([
      bulkSaveExamResults(TENANT, [mark({ studentId: STUDENT_1, marksObtained: 70 })]),
      bulkSaveExamResults(TENANT, [mark({ studentId: STUDENT_2, marksObtained: 80 })]),
    ]);
    expect(outcomes.every((outcome) => outcome.status === "fulfilled")).toBe(true);
    const rows = await withTenant(TENANT, (tx) =>
      tx
        .select({ studentId: examResults.studentId, marks: examResults.marksObtained })
        .from(examResults)
        .where(eq(examResults.workspaceSubdomain, TENANT)),
    );
    expect(rows.map((row) => row.studentId).sort()).toEqual([STUDENT_1, STUDENT_2]);
  });

  it("serialises overlapping batches written in opposite orders without 40P01", async () => {
    await bulkSaveExamResults(TENANT, [
      mark({ studentId: STUDENT_1, marksObtained: 60 }),
      mark({ studentId: STUDENT_2, marksObtained: 60 }),
    ]);
    const versioned = await withTenant(TENANT, (tx) =>
      tx
        .select({ studentId: examResults.studentId, version: examResults.version })
        .from(examResults)
        .where(eq(examResults.workspaceSubdomain, TENANT)),
    );
    const tokens = new Map(versioned.map((row) => [row.studentId, row.version]));

    const outcomes = await Promise.allSettled([
      bulkSaveExamResults(TENANT, [
        mark({ studentId: STUDENT_1, marksObtained: 71, version: tokens.get(STUDENT_1)! }),
        mark({ studentId: STUDENT_2, marksObtained: 72, version: tokens.get(STUDENT_2)! }),
      ]),
      bulkSaveExamResults(TENANT, [
        mark({ studentId: STUDENT_2, marksObtained: 81, version: tokens.get(STUDENT_2)! }),
        mark({ studentId: STUDENT_1, marksObtained: 82, version: tokens.get(STUDENT_1)! }),
      ]),
    ]);

    const rejected = outcomes.filter((outcome) => outcome.status === "rejected");
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);
    for (const outcome of rejected) {
      expect(extractPgErrorCode((outcome as PromiseRejectedResult).reason)).not.toBe("40P01");
    }
  });

  it("lets exactly one concurrent publication win the compare-and-set", async () => {
    await saveExamResult(TENANT, mark({ marksObtained: 75 }));
    const write = (actorId: string) =>
      setExamResultsFinalized(TENANT, {
        examId: EXAM,
        resultsFinalizedAt: new Date(),
        status: "completed",
        actorId,
        expect: "unpublished",
      });
    const outcomes = await Promise.allSettled([write("u-1"), write("u-2")]);
    const fulfilled = outcomes.filter((outcome) => outcome.status === "fulfilled");
    const written = fulfilled.filter(
      (outcome) => (outcome as PromiseFulfilledResult<unknown>).value !== null,
    );
    expect(written).toHaveLength(1);
  });

  it("keeps a moderation racing a marks save coherent (one conflict, no mixed row)", async () => {
    await saveExamResult(TENANT, mark({ marksObtained: 60 }));
    const [saved, moderated] = await Promise.allSettled([
      saveExamResult(TENANT, mark({ marksObtained: 88, version: 1 })),
      applyExamResultModeration(TENANT, {
        examId: EXAM,
        studentId: STUDENT_1,
        graceMarks: 5,
        reason: "concurrency review",
        actorId: "u-1",
        version: 1,
      }),
    ]);

    expect([saved.status, moderated.status].filter((status) => status === "rejected")).toHaveLength(
      1,
    );
    const [row] = await withTenant(TENANT, (tx) =>
      tx
        .select({ marks: examResults.marksObtained, grace: examResults.graceMarks })
        .from(examResults)
        .where(
          and(
            eq(examResults.workspaceSubdomain, TENANT),
            eq(examResults.examId, EXAM),
            eq(examResults.studentId, STUDENT_1),
          ),
        ),
    );
    // Either the new mark with zero grace, or the original mark with the moderation applied.
    expect([
      { marks: 88, grace: 0 },
      { marks: 60, grace: 5 },
    ]).toContainEqual({ marks: row?.marks, grace: row?.grace });
    expect(row?.marks === 88 && Number(row?.grace) === 5).toBe(false);
  });
});
