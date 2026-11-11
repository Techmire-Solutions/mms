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
  bulkSaveExamResults,
  saveExamResult,
} from "../../db/repositories/examinationResultsRepository.js";
import { bulkSoftDeleteExams } from "../../db/repositories/examinationExamsRepository.js";
import { ConflictError } from "../../lib/httpErrors.js";
import { extractPgErrorCode, requireDatabaseConnection } from "./dbTestSupport.js";

/**
 * Real-Postgres regression suite for the examination marks invariants
 * (docs/examinations-schema-persistence-audit-2026-11-11.md):
 *   - `marks_obtained` is exact decimal (numeric(8,2)), not an integer that 500s on "85.5";
 *   - the business key `(exam, student)` — not the surrogate id — is the upsert arbiter;
 *   - `version` is an honest OCC token, so a stale save 409s instead of overwriting;
 *   - published and archived exams refuse mark writes;
 *   - the database itself refuses marks above the exam total and totals below a recorded mark;
 *   - every score change appends an audit event.
 */

const TENANT = "exam-integrity-test";
const SESSION = "ses-exam-integrity";
const CLASS = "cls-exam-integrity";
const EXAM = "ex-exam-integrity";
const STUDENT_1 = "stu-exam-1";
const STUDENT_2 = "stu-exam-2";

function mark(overrides: Partial<ExamResult> = {}): ExamResult {
  return {
    id: overrides.id ?? `er-${Math.random().toString(36).slice(2, 10)}`,
    examId: overrides.examId ?? EXAM,
    studentId: overrides.studentId ?? STUDENT_1,
    marksObtained: overrides.marksObtained ?? 72.5,
    ...(overrides.version !== undefined ? { version: overrides.version } : {}),
    ...(overrides.markedBy !== undefined ? { markedBy: overrides.markedBy } : {}),
  };
}

async function seedFixtures(): Promise<void> {
  const tx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
  try {
    await tx.tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.tx
      .insert(workspaces)
      .values({ id: `ws-${TENANT}`, subdomain: TENANT, madrasaName: "Exam Integrity" })
      .onConflictDoNothing();
    await tx.tx.insert(students).values([
      { id: STUDENT_1, workspaceSubdomain: TENANT, grNumber: "gr-exam-1", status: "active" },
      { id: STUDENT_2, workspaceSubdomain: TENANT, grNumber: "gr-exam-2", status: "active" },
    ]);
    await tx.tx
      .insert(sessions)
      .values({ id: SESSION, workspaceSubdomain: TENANT, name: "Exam Session" });
    await tx.tx
      .insert(sessionClasses)
      .values({ id: CLASS, workspaceSubdomain: TENANT, sessionId: SESSION, name: "Class" });
    await tx.commit();
  } catch (error) {
    await tx.rollback().catch(() => undefined);
    throw error;
  }
}

/** Fresh exam + marks state for one test. */
async function resetExamState(): Promise<void> {
  await withTenant(TENANT, async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.delete(examResults).where(eq(examResults.workspaceSubdomain, TENANT));
    await tx.delete(examClasses).where(eq(examClasses.workspaceSubdomain, TENANT));
    await tx.delete(exams).where(eq(exams.workspaceSubdomain, TENANT));
    await tx.insert(exams).values({
      id: EXAM,
      workspaceSubdomain: TENANT,
      name: "Midterm",
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

async function markRows(): Promise<
  Array<{ id: string; studentId: string; marksObtained: number; version: number }>
> {
  return withTenant(TENANT, (tx) =>
    tx
      .select({
        id: examResults.id,
        studentId: examResults.studentId,
        marksObtained: examResults.marksObtained,
        version: examResults.version,
      })
      .from(examResults)
      .where(eq(examResults.workspaceSubdomain, TENANT))
      .orderBy(examResults.studentId),
  );
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

describe("exam_results column shape (real Postgres)", () => {
  it("stores marks exactly at numeric(8,2) scale", async () => {
    await saveExamResult(TENANT, mark({ marksObtained: 85.5 }));
    let rows = await markRows();
    expect(rows[0]?.marksObtained).toBe(85.5);

    await saveExamResult(TENANT, mark({ marksObtained: 61.239 }));
    rows = await markRows();
    expect(rows[0]?.marksObtained).toBe(61.24);
  });

  it("has no duplicate exam prefix index and keeps the unique business-key index", async () => {
    const indexes = await withTenant(TENANT, (tx) =>
      tx.execute<{ indexname: string }>(sql`
        SELECT indexname FROM pg_indexes
         WHERE schemaname = 'public' AND tablename = 'exam_results'
      `),
    );
    const names = indexes.rows.map((row) => row.indexname);
    expect(names).toContain("exam_results_workspace_exam_student_uidx");
    expect(names).not.toContain("exam_results_workspace_exam_idx");
  });
});

describe("marks upsert arbiter and OCC", () => {
  it("arbitrates on (exam, student), so a new id updates the existing row", async () => {
    await saveExamResult(TENANT, mark({ id: "er-stable", marksObtained: 40 }));
    await saveExamResult(TENANT, mark({ id: "er-other", marksObtained: 77 }));

    const rows = await markRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("er-stable");
    expect(rows[0]?.marksObtained).toBe(77);
  });

  it("increments version on every write and refuses a stale token", async () => {
    await saveExamResult(TENANT, mark({ marksObtained: 40 }));
    expect((await markRows())[0]?.version).toBe(1);

    // A tokenless write still advances the version, so older readers go stale immediately.
    await saveExamResult(TENANT, mark({ marksObtained: 50 }));
    expect((await markRows())[0]?.version).toBe(2);

    await expect(
      saveExamResult(TENANT, mark({ marksObtained: 95, version: 1 })),
    ).rejects.toBeInstanceOf(ConflictError);
    expect((await markRows())[0]?.marksObtained).toBe(50);

    await saveExamResult(TENANT, mark({ marksObtained: 95, version: 2 }));
    const rows = await markRows();
    expect(rows[0]?.marksObtained).toBe(95);
    expect(rows[0]?.version).toBe(3);
  });

  it("writes the whole batch or nothing when one row is stale", async () => {
    await bulkSaveExamResults(TENANT, [
      mark({ studentId: STUDENT_1, marksObtained: 60 }),
      mark({ studentId: STUDENT_2, marksObtained: 61 }),
    ]);
    // Advance both tokens past the insert default so the first version is genuinely stale.
    await bulkSaveExamResults(TENANT, [
      mark({ studentId: STUDENT_1, marksObtained: 60 }),
      mark({ studentId: STUDENT_2, marksObtained: 61 }),
    ]);

    await expect(
      bulkSaveExamResults(TENANT, [
        mark({ studentId: STUDENT_1, marksObtained: 90, version: 1 }),
        mark({ studentId: STUDENT_2, marksObtained: 91 }),
      ]),
    ).rejects.toBeInstanceOf(ConflictError);

    const rows = await markRows();
    expect(rows.map((row) => row.marksObtained)).toEqual([60, 61]);
  });

  it("serialises two simultaneous writes carrying the same token — exactly one wins", async () => {
    await saveExamResult(TENANT, mark({ marksObtained: 40 }));
    expect((await markRows())[0]?.version).toBe(1);

    // Both writers read version 1 and race; the row lock serialises them, so the loser's
    // `setWhere version = 1` matches nothing and returns 409 instead of overwriting the winner.
    const outcomes = await Promise.allSettled([
      saveExamResult(TENANT, mark({ marksObtained: 70, version: 1 })),
      saveExamResult(TENANT, mark({ marksObtained: 80, version: 1 })),
    ]);
    const rejected = outcomes.filter((outcome) => outcome.status === "rejected");
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toBeInstanceOf(ConflictError);

    const rows = await markRows();
    expect(rows[0]?.version).toBe(2);
    expect([70, 80]).toContain(rows[0]?.marksObtained);
  });
});

describe("published and archived exams are immutable", () => {
  it("refuses mark writes once results are published", async () => {
    await saveExamResult(TENANT, mark({ marksObtained: 70 }));
    await withTenant(TENANT, (tx) =>
      tx
        .update(exams)
        .set({ resultsFinalizedAt: new Date(), status: "completed" })
        .where(and(eq(exams.workspaceSubdomain, TENANT), eq(exams.id, EXAM))),
    );

    await expect(saveExamResult(TENANT, mark({ marksObtained: 71 }))).rejects.toMatchObject({
      statusCode: 409,
      type: "exam_results_finalized",
    });
    expect((await markRows())[0]?.marksObtained).toBe(70);
  });

  it("refuses mark writes for an archived exam", async () => {
    await bulkSoftDeleteExams(TENANT, [EXAM], "actor", "created by mistake");
    await expect(saveExamResult(TENANT, mark({ marksObtained: 71 }))).rejects.toMatchObject({
      statusCode: 409,
      type: "exam_archived",
    });
  });

  it("refuses to soft-delete an exam with published results", async () => {
    await withTenant(TENANT, (tx) =>
      tx
        .update(exams)
        .set({ resultsFinalizedAt: new Date() })
        .where(and(eq(exams.workspaceSubdomain, TENANT), eq(exams.id, EXAM))),
    );
    await expect(bulkSoftDeleteExams(TENANT, [EXAM], "actor", "reason")).rejects.toMatchObject({
      statusCode: 409,
      type: "unpublish_first",
    });
  });
});

describe("database-enforced score invariants", () => {
  it("rejects a mark above the exam total (trigger, 23514)", async () => {
    let code: string | undefined;
    try {
      await withTenant(TENANT, (tx) =>
        tx.insert(examResults).values({
          id: "er-over",
          workspaceSubdomain: TENANT,
          examId: EXAM,
          studentId: STUDENT_1,
          marksObtained: 120,
        }),
      );
    } catch (error) {
      code = extractPgErrorCode(error);
    }
    expect(code).toBe("23514");
  });

  it("rejects lowering the exam total below a recorded mark", async () => {
    await saveExamResult(TENANT, mark({ marksObtained: 88 }));

    let code: string | undefined;
    try {
      await withTenant(TENANT, (tx) =>
        tx
          .update(exams)
          .set({ totalMarks: 50 })
          .where(and(eq(exams.workspaceSubdomain, TENANT), eq(exams.id, EXAM))),
      );
    } catch (error) {
      code = extractPgErrorCode(error);
    }
    expect(code).toBe("23514");
  });

  it("enforces the exams range and status checks", async () => {
    const invalid = [
      { totalMarks: 100, passingMarks: 120, duration: 60, status: "ongoing" },
      { totalMarks: 0, passingMarks: 0, duration: 60, status: "ongoing" },
      { totalMarks: 100, passingMarks: 50, duration: 0, status: "ongoing" },
      { totalMarks: 100, passingMarks: 50, duration: 60, status: "postponed" },
    ];

    for (const [index, values] of invalid.entries()) {
      let code: string | undefined;
      try {
        await withTenant(TENANT, (tx) =>
          tx.insert(exams).values({
            id: `ex-invalid-${index}`,
            workspaceSubdomain: TENANT,
            name: "Invalid",
            date: "2026-04-01",
            ...values,
          }),
        );
      } catch (error) {
        code = extractPgErrorCode(error);
      }
      expect(code, JSON.stringify(values)).toBe("23514");
    }
  });
});

describe("mark writes are audited", () => {
  it("appends an audit event for a score change in the same transaction", async () => {
    await saveExamResult(TENANT, mark({ id: "er-audited", marksObtained: 55, markedBy: "u-1" }));

    const events = await withTenant(TENANT, (tx) =>
      tx
        .select({
          recordId: auditTrailEvents.recordId,
          actionType: auditTrailEvents.actionType,
          newState: auditTrailEvents.newState,
        })
        .from(auditTrailEvents)
        .where(
          and(
            eq(auditTrailEvents.workspaceSubdomain, TENANT),
            eq(auditTrailEvents.tableName, "exam_results"),
            eq(auditTrailEvents.recordId, "er-audited"),
          ),
        ),
    );

    expect(events).toHaveLength(1);
    expect(events[0]?.recordId).toBe("er-audited");
    expect(events[0]?.actionType).toBe("CREATE");
    expect(events[0]?.newState).toContain('"marksObtained":55');
  });
});
