import { EXAM_STATUSES, type ExamStatus } from "@mms/shared";
import { and, eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Exam, ExamResult } from "@mms/shared";
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
  listExamResultsByWorkspace,
  replaceExamResultsForWorkspace,
  saveExamResult,
} from "../../db/repositories/examinationResultsRepository.js";
import {
  bulkRestoreExams,
  bulkSaveExams,
  bulkSoftDeleteExams,
  listExamsByWorkspace,
  replaceExamsForWorkspace,
} from "../../db/repositories/examinationExamsRepository.js";
import { setExamResultsFinalized } from "../../db/repositories/examClassMembershipRepository.js";
import { setExamAttendanceGate } from "../../db/repositories/examEligibilityRepository.js";
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

  it("rejects lowering the total below a moderated effective score (grace included)", async () => {
    await saveExamResult(TENANT, mark({ id: "er-grace-bound", marksObtained: 58 }));
    await applyExamResultModeration(TENANT, {
      examId: EXAM,
      studentId: STUDENT_1,
      graceMarks: 5,
      reason: "board moderation",
      actorId: "u-admin",
    });

    // The raw mark (58) is below 60, but the effective score (63) is not: the old guard compared the
    // raw mark only and accepted the change, leaving a moderated score above the total.
    const code = await pgCode(() =>
      withTenant(TENANT, (tx) =>
        tx
          .update(exams)
          .set({ totalMarks: 60 })
          .where(and(eq(exams.workspaceSubdomain, TENANT), eq(exams.id, EXAM))),
      ),
    );
    expect(code).toBe("23514");

    // Lowering to exactly the effective score is allowed.
    await withTenant(TENANT, (tx) =>
      tx
        .update(exams)
        .set({ totalMarks: 63 })
        .where(and(eq(exams.workspaceSubdomain, TENANT), eq(exams.id, EXAM))),
    );
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
    const invalid: Array<Partial<typeof exams.$inferInsert>> = [
      { totalMarks: 100, passingMarks: 120, duration: 60, status: "ongoing" },
      { totalMarks: 0, passingMarks: 0, duration: 60, status: "ongoing" },
      { totalMarks: 100, passingMarks: 50, duration: 0, status: "ongoing" },
      // Deliberately outside the enum: proves the DB CHECK still rejects unknown statuses.
      { totalMarks: 100, passingMarks: 50, duration: 60, status: "postponed" as ExamStatus },
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

  it("accepts every shared exam status at the DB boundary", async () => {
    const ids = EXAM_STATUSES.map((status) => `ex-status-${status}`);
    for (const [index, status] of EXAM_STATUSES.entries()) {
      await withTenant(TENANT, (tx) =>
        tx.insert(exams).values({
          id: ids[index]!,
          workspaceSubdomain: TENANT,
          name: `Status ${status}`,
          date: "2026-04-01",
          status,
        }),
      );
    }
    const rows = await withTenant(TENANT, (tx) =>
      tx
        .select({ status: exams.status })
        .from(exams)
        .where(and(eq(exams.workspaceSubdomain, TENANT), inArray(exams.id, ids))),
    );
    expect(rows.map((row) => row.status).sort()).toEqual([...EXAM_STATUSES].sort());
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

/** A full `Exam` record for the whole-collection restore path. */
function examRecord(overrides: Partial<Exam> = {}): Exam {
  return {
    id: EXAM,
    name: "Midterm",
    subject: "",
    subjectId: "",
    totalMarks: 100,
    passingMarks: 50,
    date: "2026-03-10",
    duration: 90,
    classIds: [CLASS],
    status: "ongoing",
    description: "",
    ...overrides,
  } as Exam;
}

/** Captures the SQLSTATE of a rejected statement instead of failing the assertion path. */
async function pgCode(run: () => Promise<unknown>): Promise<string | undefined> {
  try {
    await run();
    return undefined;
  } catch (error) {
    return extractPgErrorCode(error);
  }
}

describe("restore fidelity (real Postgres)", () => {
  it("stamps restore provenance when an exam is brought back", async () => {
    expect(
      (await bulkSoftDeleteExams(TENANT, [EXAM], "u-deleter", "created by mistake")).succeeded,
    ).toBe(1);
    expect((await bulkRestoreExams(TENANT, [EXAM], "u-restorer")).succeeded).toBe(1);

    const [row] = await withTenant(TENANT, (tx) =>
      tx
        .select({
          deletedAt: exams.deletedAt,
          deletedBy: exams.deletedBy,
          restoredAt: exams.restoredAt,
          restoredBy: exams.restoredBy,
          deletedWithCascade: exams.deletedWithCascade,
        })
        .from(exams)
        .where(and(eq(exams.workspaceSubdomain, TENANT), eq(exams.id, EXAM))),
    );
    expect(row?.deletedAt).toBeNull();
    expect(row?.deletedBy).toBeNull();
    expect(row?.restoredAt).toBeInstanceOf(Date);
    expect(row?.restoredBy).toBe("u-restorer");
    expect(row?.deletedWithCascade).toBe(false);
  });

  it("round-trips publication, the attendance gate and restore evidence in a whole-collection restore", async () => {
    await replaceExamsForWorkspace(TENANT, [
      examRecord({
        status: "completed",
        minAttendancePct: 74.5,
        resultsFinalizedAt: "2026-03-10T09:00:00.000Z",
        restoredAt: "2026-03-11T10:00:00.000Z",
        restoredBy: "u-restorer",
        deletedWithCascade: false,
      }),
    ]);

    const [row] = await withTenant(TENANT, (tx) =>
      tx
        .select({
          resultsFinalizedAt: exams.resultsFinalizedAt,
          minAttendancePct: exams.minAttendancePct,
          restoredAt: exams.restoredAt,
          restoredBy: exams.restoredBy,
        })
        .from(exams)
        .where(and(eq(exams.workspaceSubdomain, TENANT), eq(exams.id, EXAM))),
    );
    // A restore that drops the stamp silently re-opens published marks; dropping the gate
    // silently disables attendance eligibility.
    expect(row?.resultsFinalizedAt?.toISOString()).toBe("2026-03-10T09:00:00.000Z");
    expect(Number(row?.minAttendancePct)).toBe(74.5);
    expect(row?.restoredAt?.toISOString()).toBe("2026-03-11T10:00:00.000Z");
    expect(row?.restoredBy).toBe("u-restorer");
  });

  it("round-trips grace marks and their attribution in a whole-collection marks restore", async () => {
    await saveExamResult(TENANT, mark({ id: "er-mod", marksObtained: 60, markedBy: "u-1" }));
    await applyExamResultModeration(TENANT, {
      examId: EXAM,
      studentId: STUDENT_1,
      graceMarks: 2.5,
      reason: "borderline script",
      actorId: "u-2",
    });

    const before = await listExamResultsByWorkspace(TENANT);
    expect(before[0]?.graceMarks).toBe(2.5);
    expect(before[0]?.createdAt).toBeTruthy();

    await replaceExamResultsForWorkspace(TENANT, before);
    const restored = (await listExamResultsByWorkspace(TENANT)).find(
      (row) => row.studentId === STUDENT_1,
    );
    expect(restored).toMatchObject({
      marksObtained: 60,
      graceMarks: 2.5,
      moderationReason: "borderline script",
      moderatedBy: "u-2",
    });
    expect(restored?.moderatedAt).toBeTruthy();
  });
});

describe("publication compare-and-set (real Postgres)", () => {
  it("writes a publish once and refuses a second write against the same stale expectation", async () => {
    const publish = (at: string) => ({
      examId: EXAM,
      resultsFinalizedAt: new Date(at),
      status: "completed" as const,
      actorId: "u-admin",
      reason: "publish",
      expect: "unpublished" as const,
    });

    const first = await setExamResultsFinalized(TENANT, publish("2026-03-10T09:00:00.000Z"));
    expect(first?.status).toBe("completed");

    // The loser of a concurrent double-publish writes nothing.
    const second = await setExamResultsFinalized(TENANT, publish("2026-03-10T10:00:00.000Z"));
    expect(second).toBeNull();

    const unlock = await setExamResultsFinalized(TENANT, {
      examId: EXAM,
      resultsFinalizedAt: null,
      status: "ongoing",
      actorId: "u-admin",
      reason: "unlock",
      expect: "published",
    });
    expect(unlock?.resultsFinalizedAt).toBeNull();

    const staleUnlock = await setExamResultsFinalized(TENANT, {
      examId: EXAM,
      resultsFinalizedAt: null,
      status: "ongoing",
      actorId: "u-admin",
      reason: "unlock again",
      expect: "published",
    });
    expect(staleUnlock).toBeNull();
  });
});

describe("published exam immutability at the database", () => {
  it("rejects trashing or re-weighting a published exam (23514) and allows it after an unlock", async () => {
    await setExamResultsFinalized(TENANT, {
      examId: EXAM,
      resultsFinalizedAt: new Date("2026-03-10T09:00:00.000Z"),
      status: "completed",
      actorId: "u-admin",
      reason: "publish",
      expect: "unpublished",
    });

    const trashCode = await pgCode(() =>
      withTenant(TENANT, (tx) =>
        tx
          .update(exams)
          .set({ deletedAt: new Date() })
          .where(and(eq(exams.workspaceSubdomain, TENANT), eq(exams.id, EXAM))),
      ),
    );
    expect(trashCode).toBe("23514");

    const reweightCode = await pgCode(() =>
      withTenant(TENANT, (tx) =>
        tx
          .update(exams)
          .set({ totalMarks: 1 })
          .where(and(eq(exams.workspaceSubdomain, TENANT), eq(exams.id, EXAM))),
      ),
    );
    expect(reweightCode).toBe("23514");

    await setExamResultsFinalized(TENANT, {
      examId: EXAM,
      resultsFinalizedAt: null,
      status: "ongoing",
      actorId: "u-admin",
      reason: "unlock",
      expect: "published",
    });
    // Unpublished again: the same trash write is legitimate.
    await withTenant(TENANT, (tx) =>
      tx
        .update(exams)
        .set({ deletedAt: new Date() })
        .where(and(eq(exams.workspaceSubdomain, TENANT), eq(exams.id, EXAM))),
    );
  });
});

describe("exam list projection (real Postgres)", () => {
  it("returns the per-exam attendance gate the eligibility endpoint set", async () => {
    await setExamAttendanceGate(TENANT, {
      examId: EXAM,
      minAttendancePct: 74.5,
      actorId: "u-admin",
    });

    const [exam] = await listExamsByWorkspace(TENANT);
    expect(exam?.minAttendancePct).toBe(74.5);
  });
});

describe("session archival keeps exam evidence intact (real Postgres)", () => {
  it("keeps exams and marks when the session is archived, and blocks a hard purge (23503)", async () => {
    await saveExamResult(TENANT, mark());

    await withTenant(TENANT, (tx) =>
      tx
        .update(sessions)
        .set({ deletedAt: new Date() })
        .where(and(eq(sessions.workspaceSubdomain, TENANT), eq(sessions.id, SESSION))),
    );

    const active = await listExamsByWorkspace(TENANT);
    expect(active.some((exam) => exam.id === EXAM)).toBe(true);
    expect(await markRows()).toHaveLength(1);

    // `exam_classes -> session_classes` is RESTRICT, so a session purge cannot vaporise the
    // exam/marks evidence without deleting the exam explicitly first.
    const code = await pgCode(() =>
      withTenant(TENANT, async (tx) => {
        await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
        await tx
          .delete(sessions)
          .where(and(eq(sessions.workspaceSubdomain, TENANT), eq(sessions.id, SESSION)));
      }),
    );
    expect(code).toBe("23503");

    // Leave the shared fixture the way the other tests expect it.
    await withTenant(TENANT, (tx) =>
      tx
        .update(sessions)
        .set({ deletedAt: null })
        .where(and(eq(sessions.workspaceSubdomain, TENANT), eq(sessions.id, SESSION))),
    );
  });
});

describe("state-machine guards on the live save path (real Postgres)", () => {
  it("refuses a bulk save on an archived exam (409 exam_archived)", async () => {
    await bulkSoftDeleteExams(TENANT, [EXAM], "u-deleter", "scheduling mistake");

    await expect(
      bulkSaveExams(TENANT, [examRecord({ name: "Renamed while trashed" })]),
    ).rejects.toMatchObject({ statusCode: 409, type: "exam_archived" });

    // Restoring keeps the original row untouched by the rejected save.
    await bulkRestoreExams(TENANT, [EXAM], "u-restorer");
    const [row] = await listExamsByWorkspace(TENANT);
    expect(row?.name).toBe("Midterm");
  });

  it("audits exam creation and scoring-frame changes through the bulk save path", async () => {
    const createdId = "ex-bulk-audited";
    await bulkSaveExams(TENANT, [
      examRecord({ id: createdId, name: "Bulk created", status: "ongoing" }),
    ]);
    // The UI edits through this path; a total-marks change re-grades every student and must be
    // attributable here (the previous implementation only audited the unreachable single save).
    await bulkSaveExams(TENANT, [examRecord({ totalMarks: 120 })]);

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
            eq(auditTrailEvents.tableName, "exams"),
          ),
        ),
    );
    expect(
      events.some((event) => event.recordId === createdId && event.actionType === "CREATE"),
    ).toBe(true);
    expect(
      events.some(
        (event) =>
          event.recordId === createdId && event.newState?.includes('"reasonCode":"exam_created"'),
      ),
    ).toBe(true);
    expect(
      events.some(
        (event) =>
          event.recordId === EXAM &&
          event.newState?.includes("120") &&
          event.newState?.includes('"reasonCode":"scoring_frame"'),
      ),
    ).toBe(true);
  });

  it("reason-codes a pure status move as a status override", async () => {
    await bulkSaveExams(TENANT, [examRecord({ status: "completed" })]);

    const events = await withTenant(TENANT, (tx) =>
      tx
        .select({ recordId: auditTrailEvents.recordId, newState: auditTrailEvents.newState })
        .from(auditTrailEvents)
        .where(
          and(
            eq(auditTrailEvents.workspaceSubdomain, TENANT),
            eq(auditTrailEvents.tableName, "exams"),
            eq(auditTrailEvents.recordId, EXAM),
          ),
        ),
    );
    expect(events.some((event) => event.newState?.includes('"reasonCode":"status_override"'))).toBe(
      true,
    );
  });

  it("refuses to publish once a cancel has moved the status (CAS state predicate)", async () => {
    await bulkSaveExams(TENANT, [examRecord({ status: "cancelled" })]);

    const blocked = await setExamResultsFinalized(TENANT, {
      examId: EXAM,
      resultsFinalizedAt: new Date("2026-03-10T09:00:00.000Z"),
      status: "completed",
      actorId: "u-admin",
      reason: "publish",
      expect: "unpublished",
      require: "publishable",
    });
    expect(blocked).toBeNull();
  });

  it("refuses to unlock once an owning session is completed (CAS state predicate)", async () => {
    await setExamResultsFinalized(TENANT, {
      examId: EXAM,
      resultsFinalizedAt: new Date("2026-03-10T09:00:00.000Z"),
      status: "completed",
      actorId: "u-admin",
      reason: "publish",
      expect: "unpublished",
    });
    await withTenant(TENANT, (tx) =>
      tx
        .update(sessions)
        .set({ status: "completed" })
        .where(and(eq(sessions.workspaceSubdomain, TENANT), eq(sessions.id, SESSION))),
    );

    const blocked = await setExamResultsFinalized(TENANT, {
      examId: EXAM,
      resultsFinalizedAt: null,
      status: "ongoing",
      actorId: "u-admin",
      reason: "unlock",
      expect: "published",
      require: "unlockable",
    });
    expect(blocked).toBeNull();

    await withTenant(TENANT, (tx) =>
      tx
        .update(sessions)
        .set({ status: "draft" })
        .where(and(eq(sessions.workspaceSubdomain, TENANT), eq(sessions.id, SESSION))),
    );
  });
});

describe("audit evidence for grade-affecting actions", () => {
  it("reason-codes a mark entry and a later correction", async () => {
    await saveExamResult(TENANT, mark({ id: "er-reasoned", marksObtained: 55, markedBy: "u-1" }));
    await saveExamResult(TENANT, mark({ id: "er-reasoned", marksObtained: 61, markedBy: "u-2" }));

    const events = await withTenant(TENANT, (tx) =>
      tx
        .select({ actionType: auditTrailEvents.actionType, newState: auditTrailEvents.newState })
        .from(auditTrailEvents)
        .where(
          and(
            eq(auditTrailEvents.workspaceSubdomain, TENANT),
            eq(auditTrailEvents.tableName, "exam_results"),
            eq(auditTrailEvents.recordId, "er-reasoned"),
          ),
        ),
    );
    expect(events.some((event) => event.newState?.includes('"reasonCode":"marks_entry"'))).toBe(
      true,
    );
    expect(
      events.some(
        (event) =>
          event.actionType === "UPDATE" &&
          event.newState?.includes('"reasonCode":"marks_correction"'),
      ),
    ).toBe(true);
  });

  it("audits an attendance-gate change with its reason code and reason", async () => {
    await setExamAttendanceGate(TENANT, {
      examId: EXAM,
      minAttendancePct: 75,
      actorId: "u-controller",
      reason: "policy review",
    });

    const events = await withTenant(TENANT, (tx) =>
      tx
        .select({ newState: auditTrailEvents.newState })
        .from(auditTrailEvents)
        .where(
          and(
            eq(auditTrailEvents.workspaceSubdomain, TENANT),
            eq(auditTrailEvents.tableName, "exams"),
            eq(auditTrailEvents.recordId, EXAM),
          ),
        ),
    );
    expect(
      events.some(
        (event) =>
          event.newState?.includes('"reasonCode":"attendance_gate"') &&
          event.newState?.includes("policy review"),
      ),
    ).toBe(true);
  });
});

describe("the audit trail is append-only (real Postgres)", () => {
  it("rejects a direct UPDATE or DELETE of an audit event", async () => {
    await saveExamResult(TENANT, mark({ id: "er-immutable", marksObtained: 55, markedBy: "u-1" }));

    expect(
      await pgCode(() =>
        withTenant(TENANT, (tx) =>
          tx.execute(
            sql`UPDATE audit_trail_events SET new_state = '{}' WHERE record_id = 'er-immutable'`,
          ),
        ),
      ),
    ).toBe("23514");
    expect(
      await pgCode(() =>
        withTenant(TENANT, (tx) =>
          tx.execute(sql`DELETE FROM audit_trail_events WHERE record_id = 'er-immutable'`),
        ),
      ),
    ).toBe("23514");
  });

  it("keeps the audited purge escape for retention jobs (and only behind it)", async () => {
    await saveExamResult(TENANT, mark({ id: "er-purgeable", marksObtained: 55, markedBy: "u-1" }));

    // The retention/hard-purge path opens the escape; this transaction rolls back, so the chain
    // stays intact while proving the trigger honours the escape.
    await expect(
      withTenant(TENANT, async (tx) => {
        await tx.execute(sql`SET LOCAL app.allow_audit_purge = 'on'`);
        await tx.execute(sql`DELETE FROM audit_trail_events WHERE record_id = 'er-purgeable'`);
        throw new Error("rollback-marker");
      }),
    ).rejects.toThrow("rollback-marker");

    const remaining = await withTenant(TENANT, (tx) =>
      tx
        .select({ id: auditTrailEvents.id })
        .from(auditTrailEvents)
        .where(eq(auditTrailEvents.recordId, "er-purgeable")),
    );
    expect(remaining).toHaveLength(1);
  });
});
