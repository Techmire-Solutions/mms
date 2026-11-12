import { and, desc, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  questionBankQuestionSnapshotSchema,
  type QuestionBankQuestion,
  type WidgetQuery,
} from "@mms/shared";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { beginLongLivedTenantTransaction, closeDatabase } from "../../db/dbConnection.js";
import { withTenant } from "../../db/tenant-context.js";
import {
  assessmentAnswers,
  assessmentResults,
  questionOptions,
  questionCategories,
  questionTags,
  questions,
  sessionClasses,
  sessions,
  students,
  testQuestions,
  testSectionQuestions,
  testSections,
  tests,
  workspaces,
} from "../../db/schema.js";
import {
  bulkRestoreQuestions,
  bulkSoftDeleteQuestions,
  findQuestionById,
  saveQuestion,
} from "../../db/repositories/questionBankQuestionsRepository.js";
import { auditTrailEvents } from "../../db/schema.js";
import {
  bindRequestAuditContext,
  bindRequestUserId,
  runWithTenant,
} from "../../lib/tenantContext.js";
import { runQuestionBankImportJob } from "../../services/questionBankImportJobService.js";
import { findTestById, saveTest } from "../../db/repositories/questionBankTestsRepository.js";
import { aggregateQuestionBankReport } from "../../db/repositories/questionBankRepositoryReport.js";
import { findSimilarQuestions } from "../../db/repositories/questionSimilarityRepository.js";
import { assemblePaperForTest } from "../../db/repositories/questionBankAssemblyPersist.js";
import { listQuestionsPage } from "../../db/repositories/questionBankRepositoryList.js";
import { listQuestionsPicker } from "../../db/repositories/questionBankRepositoryPicker.js";
import { aggregateQuestionBankWidgetQueries } from "../../db/repositories/questionBankRepositoryWidgets.js";
import {
  duplicateQuestionRow,
  setPaperPublished,
  updateQuestionStatus,
} from "../../db/repositories/questionBankLifecyclePersist.js";
import { extractPgErrorCode, requireDatabaseConnection, uniqueTenant } from "./dbTestSupport.js";

/**
 * Real-Postgres regression suite for the "exam paper" persistence layer added by migration 0238
 * (docs/examinations-schema-persistence-audit-2026-11-11-round2.md):
 *   - `tests` / `questions` / `assessment_answers` / `assessment_results` domain checks;
 *   - `test_section_questions.section_id -> test_sections` (cascade on section delete);
 *   - one active paper result per `(workspace, test, student)`, recyclable through soft delete;
 *   - the declared `assessment_results_workspace_submitted_idx` and `tests_class_fk` really exist.
 *
 * Round 3 adds the Question Bank side (docs/question-bank-schema-persistence-audit-2026-11-11.md):
 *   - option slots are unique, and a question on a graded paper is immutable;
 *   - question writes are compare-and-set (`409 stale_write`), not last-write-wins;
 *   - trash restore stamps provenance the read projection returns;
 *   - the 0240 filter/reverse-lookup indices exist and the PK-prefix duplicates are gone.
 */

const TENANT = uniqueTenant("qb-persistence");
const SESSION = `${TENANT}-session`;
const CLASS = `${TENANT}-class`;
const TEST = `${TENANT}-test`;
const QUESTION = `${TENANT}-question`;
const SECTION = `${TENANT}-section`;

async function pgCode(run: () => Promise<unknown>): Promise<string | undefined> {
  try {
    await run();
    return undefined;
  } catch (error) {
    return extractPgErrorCode(error);
  }
}

async function seedFixtures(): Promise<void> {
  const tx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
  try {
    await tx.tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.tx
      .insert(workspaces)
      .values({ id: `ws-${TENANT}`, subdomain: TENANT, madrasaName: "Paper Persistence" })
      .onConflictDoNothing();
    await tx.tx
      .insert(sessions)
      .values({ id: SESSION, workspaceSubdomain: TENANT, name: "Paper Session" });
    await tx.tx
      .insert(sessionClasses)
      .values({ id: CLASS, workspaceSubdomain: TENANT, sessionId: SESSION, name: "Class" });
    await tx.tx.insert(students).values([
      { id: `${TENANT}-stu-1`, workspaceSubdomain: TENANT, grNumber: "gr-qb-1", status: "active" },
      { id: `${TENANT}-stu-2`, workspaceSubdomain: TENANT, grNumber: "gr-qb-2", status: "active" },
    ]);
    await tx.commit();
  } catch (error) {
    await tx.rollback().catch(() => undefined);
    throw error;
  }
}

/** Fresh paper state for one test: one test, one question and one section. */
async function resetPaperState(): Promise<void> {
  await withTenant(TENANT, async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx
      .delete(testSectionQuestions)
      .where(eq(testSectionQuestions.workspaceSubdomain, TENANT));
    await tx.delete(testSections).where(eq(testSections.workspaceSubdomain, TENANT));
    await tx.delete(assessmentAnswers).where(eq(assessmentAnswers.workspaceSubdomain, TENANT));
    await tx.delete(assessmentResults).where(eq(assessmentResults.workspaceSubdomain, TENANT));
    await tx.delete(testQuestions).where(eq(testQuestions.workspaceSubdomain, TENANT));
    await tx.delete(tests).where(eq(tests.workspaceSubdomain, TENANT));
    await tx.delete(questions).where(eq(questions.workspaceSubdomain, TENANT));

    await tx.insert(tests).values({
      id: TEST,
      workspaceSubdomain: TENANT,
      name: "Midterm Paper",
      classId: CLASS,
      totalMarks: 100,
      duration: 60,
    });
    await tx.insert(questions).values({
      id: QUESTION,
      workspaceSubdomain: TENANT,
      type: "short",
      difficulty: "medium",
      text: "Write the rule.",
      answer: "…",
      marks: 5,
    });
    await tx.insert(testSections).values({
      id: SECTION,
      workspaceSubdomain: TENANT,
      testId: TEST,
      title: "Section A",
    });
  });
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await seedFixtures();
}, 120_000);

beforeEach(async () => {
  await resetPaperState();
});

afterAll(async () => {
  const cleanup = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
  try {
    await cleanup.tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await cleanup.tx
      .delete(testSectionQuestions)
      .where(eq(testSectionQuestions.workspaceSubdomain, TENANT));
    await cleanup.tx.delete(testSections).where(eq(testSections.workspaceSubdomain, TENANT));
    await cleanup.tx
      .delete(assessmentAnswers)
      .where(eq(assessmentAnswers.workspaceSubdomain, TENANT));
    await cleanup.tx
      .delete(assessmentResults)
      .where(eq(assessmentResults.workspaceSubdomain, TENANT));
    await cleanup.tx.delete(testQuestions).where(eq(testQuestions.workspaceSubdomain, TENANT));
    await cleanup.tx.delete(tests).where(eq(tests.workspaceSubdomain, TENANT));
    await cleanup.tx.delete(questions).where(eq(questions.workspaceSubdomain, TENANT));
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

describe("paper domain checks (real Postgres)", () => {
  it("rejects a non-positive paper total and duration (23514)", async () => {
    expect(
      await pgCode(() =>
        withTenant(TENANT, (tx) =>
          tx.insert(tests).values({
            id: `${TENANT}-bad-total`,
            workspaceSubdomain: TENANT,
            name: "Bad total",
            totalMarks: 0,
          }),
        ),
      ),
    ).toBe("23514");

    expect(
      await pgCode(() =>
        withTenant(TENANT, (tx) =>
          tx.insert(tests).values({
            id: `${TENANT}-bad-duration`,
            workspaceSubdomain: TENANT,
            name: "Bad duration",
            duration: 0,
          }),
        ),
      ),
    ).toBe("23514");
  });

  it("rejects negative question marks and a negative answer score (23514)", async () => {
    expect(
      await pgCode(() =>
        withTenant(TENANT, (tx) =>
          tx.insert(questions).values({
            id: `${TENANT}-bad-question`,
            workspaceSubdomain: TENANT,
            type: "short_answer",
            difficulty: "easy",
            text: "?",
            answer: "!",
            marks: -1,
          }),
        ),
      ),
    ).toBe("23514");

    await withTenant(TENANT, (tx) =>
      tx.insert(assessmentResults).values({
        id: `${TENANT}-result-score`,
        workspaceSubdomain: TENANT,
        testId: TEST,
        studentId: `${TENANT}-stu-1`,
        submittedAt: "2026-03-10T09:00:00Z",
      }),
    );
    expect(
      await pgCode(() =>
        withTenant(TENANT, (tx) =>
          tx.insert(assessmentAnswers).values({
            workspaceSubdomain: TENANT,
            resultId: `${TENANT}-result-score`,
            questionId: QUESTION,
            studentAnswer: "x",
            score: "-1",
          }),
        ),
      ),
    ).toBe("23514");
  });

  it("rejects a malformed submitted_at that the reports would cast (23514)", async () => {
    expect(
      await pgCode(() =>
        withTenant(TENANT, (tx) =>
          tx.insert(assessmentResults).values({
            id: `${TENANT}-result-bad-date`,
            workspaceSubdomain: TENANT,
            testId: TEST,
            studentId: `${TENANT}-stu-1`,
            submittedAt: "yesterday",
          }),
        ),
      ),
    ).toBe("23514");
  });
});

describe("section question links (real Postgres)", () => {
  it("cascades question links when a section is deleted", async () => {
    await withTenant(TENANT, (tx) =>
      tx.insert(testSectionQuestions).values({
        workspaceSubdomain: TENANT,
        sectionId: SECTION,
        questionId: QUESTION,
      }),
    );

    await withTenant(TENANT, (tx) =>
      tx
        .delete(testSections)
        .where(and(eq(testSections.workspaceSubdomain, TENANT), eq(testSections.id, SECTION))),
    );

    const links = await withTenant(TENANT, (tx) =>
      tx
        .select({ sectionId: testSectionQuestions.sectionId })
        .from(testSectionQuestions)
        .where(eq(testSectionQuestions.workspaceSubdomain, TENANT)),
    );
    expect(links).toHaveLength(0);
  });

  it("refuses a question link whose section does not exist (23503)", async () => {
    expect(
      await pgCode(() =>
        withTenant(TENANT, (tx) =>
          tx.insert(testSectionQuestions).values({
            workspaceSubdomain: TENANT,
            sectionId: `${TENANT}-missing-section`,
            questionId: QUESTION,
          }),
        ),
      ),
    ).toBe("23503");
  });
});

describe("one active paper result per (test, student)", () => {
  it("rejects a duplicate active result and allows one after the first is trashed", async () => {
    const activeResult = {
      workspaceSubdomain: TENANT,
      testId: TEST,
      studentId: `${TENANT}-stu-1`,
      submittedAt: "2026-03-10T09:00:00Z",
    };
    await withTenant(TENANT, (tx) =>
      tx.insert(assessmentResults).values({ id: `${TENANT}-r1`, ...activeResult }),
    );

    expect(
      await pgCode(() =>
        withTenant(TENANT, (tx) =>
          tx.insert(assessmentResults).values({ id: `${TENANT}-r2`, ...activeResult }),
        ),
      ),
    ).toBe("23505");

    // Soft-delete makes the key recyclable again — the partial unique index only covers active rows.
    await withTenant(TENANT, (tx) =>
      tx
        .update(assessmentResults)
        .set({ deletedAt: new Date(), deletedBy: "u-1", deletionReason: "duplicate" })
        .where(eq(assessmentResults.id, `${TENANT}-r1`)),
    );
    await withTenant(TENANT, (tx) =>
      tx.insert(assessmentResults).values({ id: `${TENANT}-r2`, ...activeResult }),
    );
    const active = await withTenant(TENANT, (tx) =>
      tx
        .select({ id: assessmentResults.id })
        .from(assessmentResults)
        .where(
          and(
            eq(assessmentResults.workspaceSubdomain, TENANT),
            eq(assessmentResults.testId, TEST),
            sql`${assessmentResults.deletedAt} is null`,
          ),
        ),
    );
    expect(active.map((row) => row.id)).toEqual([`${TENANT}-r2`]);
  });
});

describe("declared schema objects really exist (real Postgres)", () => {
  it("has the submitted-at index, the paper child indices and the tests class FK", async () => {
    const indexes = await withTenant(TENANT, (tx) =>
      tx.execute<{ indexname: string }>(sql`
        SELECT indexname FROM pg_indexes
         WHERE schemaname = 'public'
           AND tablename IN ('assessment_results', 'test_sections')
      `),
    );
    const names = indexes.rows.map((row) => row.indexname);
    expect(names).toContain("assessment_results_workspace_submitted_idx");
    expect(names).toContain("assessment_results_ws_test_student_uidx");
    expect(names).toContain("test_sections_ws_id_uidx");

    const constraints = await withTenant(TENANT, (tx) =>
      tx.execute<{ conname: string; convalidated: boolean }>(sql`
        SELECT conname, convalidated FROM pg_constraint
         WHERE conname IN ('tests_class_fk', 'test_section_questions_section_fk')
      `),
    );
    const byName = new Map(constraints.rows.map((row) => [row.conname, row.convalidated]));
    expect(byName.get("tests_class_fk")).toBe(true);
    expect(byName.get("test_section_questions_section_fk")).toBe(true);
  });
});

describe("question bank integrity (migration 0240)", () => {
  function questionRecord(version?: number): QuestionBankQuestion {
    return {
      id: QUESTION,
      categoryIds: ["cat-1"],
      type: "mcq",
      difficulty: "medium",
      questionLanguage: "en",
      text: "Pick the correct option.",
      options: ["alpha", "beta"],
      answer: "alpha",
      ...(version === undefined ? {} : { version }),
    };
  }

  async function markPaperGraded(): Promise<void> {
    await withTenant(TENANT, (tx) =>
      tx.insert(assessmentResults).values({
        id: `${TENANT}-graded`,
        workspaceSubdomain: TENANT,
        testId: TEST,
        studentId: `${TENANT}-stu-1`,
        submittedAt: "2026-03-10T09:00:00Z",
      }),
    );
  }

  it("rejects a duplicate option slot for one question (23505)", async () => {
    expect(
      await pgCode(() =>
        withTenant(TENANT, (tx) =>
          tx.insert(questionOptions).values([
            {
              id: `${QUESTION}_dup_a`,
              workspaceSubdomain: TENANT,
              questionId: QUESTION,
              optionIndex: 0,
              optionText: "alpha",
            },
            {
              id: `${QUESTION}_dup_b`,
              workspaceSubdomain: TENANT,
              questionId: QUESTION,
              optionIndex: 0,
              optionText: "beta",
            },
          ]),
        ),
      ),
    ).toBe("23505");
  });

  it("refuses to edit or trash a question that a graded paper references", async () => {
    await withTenant(TENANT, (tx) =>
      tx.insert(testQuestions).values({
        workspaceSubdomain: TENANT,
        testId: TEST,
        questionId: QUESTION,
        sortOrder: 0,
      }),
    );

    // An authoring paper is not evidence: before any result exists the question is still editable.
    await withTenant(TENANT, (tx) =>
      tx.update(questions).set({ text: "Draft wording" }).where(eq(questions.id, QUESTION)),
    );

    await markPaperGraded();

    for (const patch of [
      { text: "Rewritten after delivery" },
      { answer: "beta" },
      { marks: 99 },
      { difficulty: "hard" as const },
      { deletedAt: new Date() },
    ]) {
      expect(
        await pgCode(() =>
          withTenant(TENANT, (tx) =>
            tx.update(questions).set(patch).where(eq(questions.id, QUESTION)),
          ),
        ),
      ).toBe("23514");
    }

    // A metadata-only touch stays legal — nothing destructive changed.
    await withTenant(TENANT, (tx) =>
      tx.update(questions).set({ updatedAt: new Date() }).where(eq(questions.id, QUESTION)),
    );
  });

  it("guards a question that only a paper section references", async () => {
    await withTenant(TENANT, (tx) =>
      tx.insert(testSectionQuestions).values({
        workspaceSubdomain: TENANT,
        sectionId: SECTION,
        questionId: QUESTION,
      }),
    );
    await markPaperGraded();

    expect(
      await pgCode(() =>
        withTenant(TENANT, (tx) =>
          tx.update(questions).set({ text: "Rewritten" }).where(eq(questions.id, QUESTION)),
        ),
      ),
    ).toBe("23514");
  });

  it("rejects a stale question save and skips an unchanged re-save (409 stale_write)", async () => {
    await saveQuestion(TENANT, questionRecord(1));

    const afterFirstWrite = await findQuestionById(TENANT, QUESTION);
    expect(afterFirstWrite?.version).toBe(2);

    await expect(saveQuestion(TENANT, questionRecord(1))).rejects.toMatchObject({
      statusCode: 409,
      type: "stale_write",
    });

    // The rejected save wrote nothing — the row still carries the first writer's text.
    const untouched = await withTenant(TENANT, (tx) =>
      tx
        .select({ text: questions.text, version: questions.version })
        .from(questions)
        .where(eq(questions.id, QUESTION)),
    );
    expect(untouched[0]).toEqual({ text: "Pick the correct option.", version: 2 });

    // Re-saving the current token with identical content is a no-op, not a version bump: the
    // collection PUT no longer churns untouched rows.
    await saveQuestion(TENANT, questionRecord(2));
    expect((await findQuestionById(TENANT, QUESTION))?.version).toBe(2);

    // A real content change does bump the token.
    await saveQuestion(TENANT, { ...questionRecord(2), text: "Pick the correct option, revised." });
    const revised = await findQuestionById(TENANT, QUESTION);
    expect(revised?.version).toBe(3);
    expect(revised?.text).toBe("Pick the correct option, revised.");
  });

  it("stamps restore provenance when a question is brought back", async () => {
    await withTenant(TENANT, (tx) =>
      tx
        .update(questions)
        .set({ deletedAt: new Date(), deletedBy: "u-del", deletionReason: "duplicate" })
        .where(eq(questions.id, QUESTION)),
    );

    await bulkRestoreQuestions(TENANT, [QUESTION], "u-restore");

    const restored = await findQuestionById(TENANT, QUESTION);
    expect(restored?.deletedAt).toBeNull();
    expect(restored?.deletedBy).toBeNull();
    expect(restored?.restoredBy).toBe("u-restore");
    expect(restored?.restoredAt).toBeTruthy();
    expect(restored?.deletedWithCascade).toBe(false);

    // Upsert resurrection (the bulk-sync path) must leave evidence too — the CASE inside
    // QUESTION_UPSERT_SET is easy to get wrong.
    const second = `${TENANT}-question-2`;
    await withTenant(TENANT, (tx) =>
      tx.insert(questions).values({
        id: second,
        workspaceSubdomain: TENANT,
        type: "short",
        difficulty: "easy",
        text: "Second question",
        answer: "a",
      }),
    );
    await withTenant(TENANT, (tx) =>
      tx
        .update(questions)
        .set({ deletedAt: new Date(), deletedBy: "u-del-2", deletionReason: "superseded" })
        .where(eq(questions.id, second)),
    );
    await saveQuestion(TENANT, {
      id: second,
      categoryIds: ["cat-1"],
      type: "short",
      difficulty: "easy",
      questionLanguage: "en",
      text: "Second question",
      options: [],
      answer: "a",
    });

    const revived = await findQuestionById(TENANT, second);
    expect(revived?.deletedAt).toBeNull();
    expect(revived?.restoredAt).toBeTruthy();
    // No actor travelled on the record, so only the timestamp is attributable.
    expect(revived?.deletedWithCascade).toBe(false);
  });

  it("has the question-bank filter, reverse-lookup and citations-book indices", async () => {
    const indexes = await withTenant(TENANT, (tx) =>
      tx.execute<{ indexname: string }>(sql`
        SELECT indexname FROM pg_indexes
         WHERE schemaname = 'public'
           AND tablename IN ('questions', 'question_options', 'question_tags',
                             'question_categories', 'question_citations',
                             'test_questions', 'test_section_questions')
      `),
    );
    const names = indexes.rows.map((row) => row.indexname);
    for (const expected of [
      "questions_ws_active_difficulty_type_idx",
      "questions_ws_updated_active_idx",
      "question_options_ws_q_index_uidx",
      "test_questions_workspace_question_idx",
      "test_section_questions_workspace_question_idx",
      "question_citations_workspace_book_idx",
    ]) {
      expect(names).toContain(expected);
    }
    // The 0240 drops: each only repeated a PK prefix.
    for (const dropped of [
      "question_options_workspace_q_idx",
      "question_tags_workspace_q_idx",
      "question_citations_workspace_q_idx",
      "question_categories_workspace_q_idx",
    ]) {
      expect(names).not.toContain(dropped);
    }

    const triggers = await withTenant(TENANT, (tx) =>
      tx.execute<{ tgname: string }>(sql`
        SELECT tgname FROM pg_trigger
         WHERE tgrelid = 'questions'::regclass AND NOT tgisinternal
      `),
    );
    expect(triggers.rows.map((row) => row.tgname)).toContain("trg_questions_referenced_guard");
  });
});

describe("question lifecycle and delivered-paper integrity (migration 0241)", () => {
  function validShortQuestion(overrides: Record<string, unknown> = {}) {
    return {
      id: QUESTION,
      categoryIds: ["cat-1"],
      type: "short" as const,
      difficulty: "easy" as const,
      questionLanguage: "en" as const,
      text: "Write the rule.",
      options: [] as string[],
      answer: "…",
      ...overrides,
    };
  }

  async function linkQuestionToPaper(): Promise<void> {
    await withTenant(TENANT, (tx) =>
      tx.insert(testQuestions).values({
        workspaceSubdomain: TENANT,
        testId: TEST,
        questionId: QUESTION,
        sortOrder: 0,
      }),
    );
  }

  it("rejects an invalid changed question with coded issues (400)", async () => {
    await expect(
      saveQuestion(
        TENANT,
        validShortQuestion({ type: "mcq", options: [], answer: "x", text: "Changed stem" }),
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      type: "question_invariants",
      details: { recordId: QUESTION },
    });

    // The invalid write left the stored row untouched.
    expect((await findQuestionById(TENANT, QUESTION))?.text).toBe("Write the rule.");
  });

  it("preserves marks and tags the form does not send", async () => {
    await withTenant(TENANT, async (tx) => {
      await tx.update(questions).set({ marks: 5 }).where(eq(questions.id, QUESTION));
      await tx.insert(questionTags).values({
        workspaceSubdomain: TENANT,
        questionId: QUESTION,
        tag: "fiqh",
      });
    });

    await saveQuestion(TENANT, validShortQuestion({ text: "Write the rule, revised." }));

    const stored = await findQuestionById(TENANT, QUESTION);
    expect(stored?.text).toBe("Write the rule, revised.");
    expect(stored?.marks).toBe(5);
    expect(stored?.tags).toEqual(["fiqh"]);
  });

  it("locks content edits on an approved question", async () => {
    await withTenant(TENANT, (tx) =>
      tx.update(questions).set({ status: "approved" }).where(eq(questions.id, QUESTION)),
    );

    await expect(
      saveQuestion(TENANT, validShortQuestion({ text: "Silently rewritten." })),
    ).rejects.toMatchObject({ statusCode: 409, type: "question_locked" });

    // A metadata-only edit still passes.
    await expect(
      saveQuestion(TENANT, validShortQuestion({ difficulty: "hard" })),
    ).resolves.toBeUndefined();
    expect((await findQuestionById(TENANT, QUESTION))?.difficulty).toBe("hard");
  });

  it("blocks a content edit once a paper is published", async () => {
    await linkQuestionToPaper();
    await setPaperPublished(TENANT, { testId: TEST, published: true, actorId: "u-1" });

    await expect(
      saveQuestion(TENANT, validShortQuestion({ text: "Changed after delivery." })),
    ).rejects.toMatchObject({ statusCode: 409, type: "question_in_use" });

    // Trashing it is blocked too (the DB trigger raises check_violation).
    expect(
      await pgCode(() =>
        withTenant(TENANT, (tx) =>
          tx.update(questions).set({ deletedAt: new Date() }).where(eq(questions.id, QUESTION)),
        ),
      ),
    ).toBe("23514");
  });

  it("moves a question through the lifecycle and refuses illegal jumps", async () => {
    const drafted = await updateQuestionStatus(TENANT, {
      id: QUESTION,
      to: "under_review",
      actorId: "u-1",
    });
    expect(drafted.status).toBe("under_review");

    const approved = await updateQuestionStatus(TENANT, {
      id: QUESTION,
      to: "approved",
      actorId: "u-1",
    });
    expect(approved.status).toBe("approved");
    expect(approved.version).toBe(3);

    await expect(
      updateQuestionStatus(TENANT, { id: QUESTION, to: "draft", actorId: "u-1" }),
    ).rejects.toMatchObject({ statusCode: 409, type: "illegal_question_transition" });

    const retired = await updateQuestionStatus(TENANT, {
      id: QUESTION,
      to: "retired",
      actorId: "u-1",
    });
    expect(retired.status).toBe("retired");
    const reopened = await updateQuestionStatus(TENANT, {
      id: QUESTION,
      to: "draft",
      actorId: "u-1",
    });
    expect(reopened.status).toBe("draft");
  });

  it("refuses to reopen a question a delivered paper references", async () => {
    await withTenant(TENANT, (tx) =>
      tx.update(questions).set({ status: "approved" }).where(eq(questions.id, QUESTION)),
    );
    await linkQuestionToPaper();
    await setPaperPublished(TENANT, { testId: TEST, published: true, actorId: "u-1" });

    // approved -> retired does not alter the paper's content and stays legal.
    await expect(
      updateQuestionStatus(TENANT, { id: QUESTION, to: "retired", actorId: "u-1" }),
    ).resolves.toMatchObject({ status: "retired" });
  });

  it("duplicates a question as a new draft revision", async () => {
    const clone = await duplicateQuestionRow(TENANT, {
      sourceId: QUESTION,
      newId: `${TENANT}-revision`,
    });
    expect(clone).toMatchObject({
      id: `${TENANT}-revision`,
      status: "draft",
      text: "Write the rule.",
      marks: 5,
    });
    expect(clone.version).toBe(1);
  });

  it("snapshots the question set on publish and freezes composition", async () => {
    await linkQuestionToPaper();
    await setPaperPublished(TENANT, { testId: TEST, published: true, actorId: "u-1" });

    const snapshot = await withTenant(TENANT, (tx) =>
      tx.execute<{ question_snapshot: Record<string, unknown> | null }>(sql`
        SELECT question_snapshot FROM test_questions
         WHERE workspace_subdomain = ${TENANT} AND test_id = ${TEST}
      `),
    );
    expect(snapshot.rows[0]?.question_snapshot).toMatchObject({
      text: "Write the rule.",
      answer: "…",
      marks: 5,
    });

    const paper = await findTestById(TENANT, TEST);
    expect(paper?.publishedAt).toBeTruthy();

    // Removing the question from the published paper is refused.
    await expect(
      saveTest(TENANT, { ...(paper as NonNullable<typeof paper>), questionIds: [] }),
    ).rejects.toMatchObject({ statusCode: 409, type: "paper_locked" });

    // An unchanged composition (metadata edit) is allowed.
    await expect(
      saveTest(TENANT, {
        ...(paper as NonNullable<typeof paper>),
        name: "Midterm Paper (renamed)",
      }),
    ).resolves.toBeUndefined();
  });

  it("refuses to publish an empty paper and to unpublish one with results", async () => {
    await expect(
      setPaperPublished(TENANT, { testId: TEST, published: true, actorId: "u-1" }),
    ).rejects.toMatchObject({ statusCode: 409, type: "paper_empty" });

    await linkQuestionToPaper();
    await setPaperPublished(TENANT, { testId: TEST, published: true, actorId: "u-1" });
    await withTenant(TENANT, (tx) =>
      tx.insert(assessmentResults).values({
        id: `${TENANT}-published-result`,
        workspaceSubdomain: TENANT,
        testId: TEST,
        studentId: `${TENANT}-stu-1`,
        submittedAt: "2026-03-10T09:00:00Z",
      }),
    );

    await expect(
      setPaperPublished(TENANT, { testId: TEST, published: false, actorId: "u-1" }),
    ).rejects.toMatchObject({ statusCode: 409, type: "paper_has_results" });
  });
});

describe("list filters and picker (API hardening pass)", () => {
  it("filters by status, tag and usage, and sorts by usageCount", async () => {
    await withTenant(TENANT, async (tx) => {
      await tx.insert(questions).values([
        {
          id: `${TENANT}-approved-tagged`,
          workspaceSubdomain: TENANT,
          type: "short",
          difficulty: "easy",
          text: "Approved and tagged",
          answer: "a",
          marks: 2,
          status: "approved",
        },
        {
          id: `${TENANT}-draft`,
          workspaceSubdomain: TENANT,
          type: "short",
          difficulty: "easy",
          text: "Still a draft",
          answer: "a",
          marks: 2,
          status: "draft",
        },
      ]);
      await tx.insert(questionTags).values({
        workspaceSubdomain: TENANT,
        questionId: `${TENANT}-approved-tagged`,
        tag: "fiqh",
      });
      // Two papers reference the approved question → usageCount 2.
      await tx.insert(tests).values([
        { id: `${TENANT}-usage-1`, workspaceSubdomain: TENANT, name: "Usage 1" },
        { id: `${TENANT}-usage-2`, workspaceSubdomain: TENANT, name: "Usage 2" },
      ]);
      await tx.insert(testQuestions).values([
        {
          workspaceSubdomain: TENANT,
          testId: `${TENANT}-usage-1`,
          questionId: `${TENANT}-approved-tagged`,
        },
        {
          workspaceSubdomain: TENANT,
          testId: `${TENANT}-usage-2`,
          questionId: `${TENANT}-approved-tagged`,
        },
      ]);
    });

    const byStatus = await listQuestionsPage(TENANT, { status: "approved", limit: 10 });
    expect(byStatus.questions.map((q) => q.id)).toContain(`${TENANT}-approved-tagged`);
    expect(byStatus.questions.map((q) => q.id)).not.toContain(`${TENANT}-draft`);

    const byTag = await listQuestionsPage(TENANT, { tag: "fiqh", limit: 10 });
    expect(byTag.questions.map((q) => q.id)).toEqual([`${TENANT}-approved-tagged`]);

    const ranked = await listQuestionsPage(TENANT, {
      sortField: "usageCount",
      sortDir: "desc",
      minUsage: 2,
      limit: 10,
    });
    expect(ranked.questions.map((q) => q.id)).toEqual([`${TENANT}-approved-tagged`]);
    expect(ranked.questions[0]?.usageCount).toBe(2);
  });

  it("returns approved questions only from the picker", async () => {
    await withTenant(TENANT, (tx) =>
      tx.update(questions).set({ status: "approved" }).where(eq(questions.id, QUESTION)),
    );
    await withTenant(TENANT, (tx) =>
      tx.insert(questions).values({
        id: `${TENANT}-picker-draft`,
        workspaceSubdomain: TENANT,
        type: "short",
        difficulty: "easy",
        text: "Picker draft",
        answer: "a",
        marks: 1,
        status: "draft",
      }),
    );

    const page = await listQuestionsPicker(TENANT, { limit: 10 });
    expect(page.questions.map((q) => q.id)).toContain(QUESTION);
    expect(page.questions.map((q) => q.id)).not.toContain(`${TENANT}-picker-draft`);
  });
});

describe("tamper-evident audit (answer keys, deletes, approvals)", () => {
  async function auditRows(recordId: string, actionType?: string) {
    return withTenant(TENANT, (tx) =>
      tx
        .select({
          actionType: auditTrailEvents.actionType,
          realUserId: auditTrailEvents.realUserId,
          ipAddress: auditTrailEvents.ipAddress,
          apiEndpoint: auditTrailEvents.apiEndpoint,
          httpMethod: auditTrailEvents.httpMethod,
          oldState: auditTrailEvents.oldState,
          newState: auditTrailEvents.newState,
        })
        .from(auditTrailEvents)
        .where(
          and(
            eq(auditTrailEvents.workspaceSubdomain, TENANT),
            eq(auditTrailEvents.recordId, recordId),
            ...(actionType ? [eq(auditTrailEvents.actionType, actionType)] : []),
          ),
        )
        .orderBy(desc(auditTrailEvents.id)),
    );
  }

  it("records a create and an answer-key update with a before/after diff", async () => {
    const created = `${TENANT}-audited-create`;
    await saveQuestion(TENANT, {
      id: created,
      categoryIds: ["cat-1"],
      type: "short",
      difficulty: "easy",
      questionLanguage: "en",
      text: "Audited question",
      options: [],
      answer: "first key",
    });
    const createRows = await auditRows(created, "CREATE");
    expect(createRows).toHaveLength(1);
    expect(JSON.parse(createRows[0]!.newState ?? "{}")).toMatchObject({ answer: "first key" });

    await saveQuestion(TENANT, {
      id: created,
      categoryIds: ["cat-1"],
      type: "short",
      difficulty: "easy",
      questionLanguage: "en",
      text: "Audited question",
      options: [],
      answer: "corrected key",
    });
    const updateRows = await auditRows(created, "UPDATE");
    expect(updateRows).toHaveLength(1);
    expect(JSON.parse(updateRows[0]!.oldState ?? "{}")).toMatchObject({ answer: "first key" });
    expect(JSON.parse(updateRows[0]!.newState ?? "{}")).toMatchObject({ answer: "corrected key" });
    expect(updateRows[0]!.realUserId).toBeTruthy();
  });

  it("records the request actor, IP and endpoint when bound", async () => {
    bindRequestUserId("u-auditor");
    bindRequestAuditContext({
      ipAddress: "203.0.113.9",
      apiEndpoint: "/api/question-bank/questions/bulk",
      httpMethod: "PUT",
    });
    try {
      await saveQuestion(TENANT, {
        id: QUESTION,
        categoryIds: ["cat-1"],
        type: "short",
        difficulty: "easy",
        questionLanguage: "en",
        text: "Audited with request metadata",
        options: [],
        answer: "key",
      });
    } finally {
      bindRequestAuditContext(null);
      bindRequestUserId(null);
    }

    const [row] = await auditRows(QUESTION, "UPDATE");
    expect(row).toMatchObject({
      realUserId: "u-auditor",
      ipAddress: "203.0.113.9",
      apiEndpoint: "/api/question-bank/questions/bulk",
      httpMethod: "PUT",
    });
  });

  it("records bulk delete and restore per question", async () => {
    const deleted = await bulkSoftDeleteQuestions(TENANT, [QUESTION], "u-del", "cleanup");
    expect(deleted.succeeded).toBe(1);
    const deleteRows = await auditRows(QUESTION, "DELETE");
    expect(deleteRows.length).toBeGreaterThanOrEqual(1);
    expect(JSON.parse(deleteRows[0]!.newState ?? "{}")).toMatchObject({
      deletedBy: "u-del",
      deletionReason: "cleanup",
    });

    await bulkRestoreQuestions(TENANT, [QUESTION], "u-restore");
    const restoreRows = await auditRows(QUESTION, "RESTORE");
    expect(restoreRows.length).toBeGreaterThanOrEqual(1);
    expect(JSON.parse(restoreRows[0]!.newState ?? "{}")).toMatchObject({
      restoredBy: "u-restore",
    });
  });

  it("records a status approval with old and new status", async () => {
    await updateQuestionStatus(TENANT, {
      id: QUESTION,
      to: "under_review",
      actorId: "u-head",
      reason: "ready",
    });
    const [row] = await auditRows(QUESTION, "UPDATE");
    expect(row?.realUserId).toBe("u-head");
    expect(JSON.parse(row?.oldState ?? "{}")).toMatchObject({ status: "draft" });
    expect(JSON.parse(row?.newState ?? "{}")).toMatchObject({
      status: "under_review",
      reason: "ready",
    });
  });

  it("rejects direct mutation of an audit row", async () => {
    await saveQuestion(TENANT, {
      id: `${TENANT}-immutable`,
      categoryIds: ["cat-1"],
      type: "short",
      difficulty: "easy",
      questionLanguage: "en",
      text: "Immutable audit",
      options: [],
      answer: "a",
    });

    await expect(
      withTenant(TENANT, (tx) =>
        tx.execute(
          sql`UPDATE audit_trail_events SET real_user_id = 'forged' WHERE workspace_subdomain = ${TENANT}`,
        ),
      ),
    ).rejects.toThrow();
    await expect(
      withTenant(TENANT, (tx) =>
        tx.execute(sql`DELETE FROM audit_trail_events WHERE workspace_subdomain = ${TENANT}`),
      ),
    ).rejects.toThrow();
  });
});

describe("cross-tenant isolation (explicit predicates)", () => {
  const OTHER = uniqueTenant("qb-other");
  const OTHER_QUESTION = `${OTHER}-question`;

  beforeAll(async () => {
    const tx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    try {
      await tx.tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
      await tx.tx
        .insert(workspaces)
        .values({ id: `ws-${OTHER}`, subdomain: OTHER, madrasaName: "Other Tenancy" })
        .onConflictDoNothing();
      await tx.tx.insert(questions).values({
        id: OTHER_QUESTION,
        workspaceSubdomain: OTHER,
        type: "short",
        difficulty: "easy",
        questionLanguage: "en",
        text: "Explain the significance of the event of Ghadir Khumm in Islamic history.",
        answer: "other tenant key",
        marks: 3,
        status: "approved",
      });
      await tx.commit();
    } catch (error) {
      await tx.rollback().catch(() => undefined);
      throw error;
    }
  });

  afterAll(async () => {
    const tx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    try {
      await tx.tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
      await tx.tx.delete(questions).where(eq(questions.workspaceSubdomain, OTHER));
      await tx.tx.delete(workspaces).where(eq(workspaces.subdomain, OTHER));
      await tx.commit();
    } catch {
      await tx.rollback().catch(() => undefined);
    }
  });

  it("cannot read another tenant's question by id or through a list", async () => {
    expect(await findQuestionById(TENANT, OTHER_QUESTION)).toBeNull();

    const page = await listQuestionsPage(TENANT, { limit: 50 });
    expect(page.questions.map((q) => q.id)).not.toContain(OTHER_QUESTION);

    const picker = await listQuestionsPicker(TENANT, { limit: 50 });
    expect(picker.questions.map((q) => q.id)).not.toContain(OTHER_QUESTION);
  });

  it("scopes reports and similarity to the calling tenant", async () => {
    const report = await aggregateQuestionBankReport(TENANT);
    // Only this tenant's questions are counted; the other tenant owns one.
    const otherReport = await aggregateQuestionBankReport(OTHER);
    expect(otherReport.totalQuestions).toBe(1);
    expect(report.totalQuestions).toBeGreaterThanOrEqual(0);
    expect(report.totalQuestions).not.toBe(otherReport.totalQuestions + 1);

    const matches = await findSimilarQuestions(TENANT, {
      text: "Explain the significance of the event of Ghadir Khumm in Islamic history.",
      limit: 5,
    });
    expect(matches.map((m) => m.id)).not.toContain(OTHER_QUESTION);
  });

  it("never links another tenant's question during assembly", async () => {
    await withTenant(TENANT, (tx) =>
      tx.update(questions).set({ status: "approved" }).where(eq(questions.id, QUESTION)),
    );

    const outcome = await assemblePaperForTest(TENANT, {
      testId: TEST,
      blueprint: { excludeRecentlyUsedDays: 0, buckets: [{ count: 5 }] },
    });
    expect(outcome.questionIds).not.toContain(OTHER_QUESTION);
  });
});

describe("question bank CSV import idempotency", () => {
  const importContext = {
    tenant: TENANT,
    userId: "u-import",
    jobId: "import-job-1",
    viewerRole: "admin",
    updateProgress: async () => undefined,
  };
  const rows = [
    {
      title: "Imported: define wudu",
      category: "fiqh",
      type: "short",
      explanation: "Ritual purity",
      points: "3",
    },
  ];

  async function importedRows() {
    return withTenant(TENANT, (tx) =>
      tx
        .select({ id: questions.id, status: questions.status, text: questions.text })
        .from(questions)
        .where(sql`${questions.id} like 'q-imp-%'`),
    );
  }

  it("re-running the same job upserts instead of duplicating", async () => {
    await runWithTenant(TENANT, () => runQuestionBankImportJob(rows, importContext));
    const first = await importedRows();
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ status: "draft", text: "Imported: define wudu" });

    await runWithTenant(TENANT, () => runQuestionBankImportJob(rows, importContext));
    const second = await importedRows();
    expect(second).toHaveLength(1);
    expect(second[0]?.id).toBe(first[0]?.id);

    // One CREATE row for the question, not one per attempt.
    const creates = await withTenant(TENANT, (tx) =>
      tx
        .select({ id: auditTrailEvents.id })
        .from(auditTrailEvents)
        .where(
          and(
            eq(auditTrailEvents.workspaceSubdomain, TENANT),
            eq(auditTrailEvents.recordId, first[0]!.id),
            eq(auditTrailEvents.actionType, "CREATE"),
          ),
        ),
    );
    expect(creates).toHaveLength(1);
  });

  it("a different job id creates a distinct question set", async () => {
    await runWithTenant(TENANT, () => runQuestionBankImportJob(rows, importContext));
    await runWithTenant(TENANT, () =>
      runQuestionBankImportJob(rows, { ...importContext, jobId: "import-job-2" }),
    );
    const all = await importedRows();
    expect(all.length).toBeGreaterThanOrEqual(2);
    expect(new Set(all.map((r) => r.id)).size).toBe(all.length);
  });
});

describe("widget aggregate field resolution", () => {
  async function seedWidgetQuestions(): Promise<void> {
    await withTenant(TENANT, async (tx) => {
      await tx.insert(questions).values([
        {
          id: `${TENANT}-w-draft`,
          workspaceSubdomain: TENANT,
          type: "short",
          difficulty: "easy",
          text: "Widget draft",
          answer: "a",
          marks: 1,
          status: "draft",
        },
        {
          id: `${TENANT}-w-approved`,
          workspaceSubdomain: TENANT,
          type: "short",
          difficulty: "easy",
          text: "Widget approved",
          answer: "b",
          marks: 1,
          status: "approved",
        },
      ]);
      await tx.insert(questionCategories).values([
        { workspaceSubdomain: TENANT, questionId: `${TENANT}-w-draft`, categoryId: "fiqh" },
        { workspaceSubdomain: TENANT, questionId: `${TENANT}-w-approved`, categoryId: "history" },
      ]);
      await tx
        .insert(testQuestions)
        .values([{ workspaceSubdomain: TENANT, testId: TEST, questionId: `${TENANT}-w-approved` }]);
    });
  }

  it("supports status, category, usage and prefix filters with multi-rule AND", async () => {
    // Seeded per test: the suite's beforeEach resets question state.
    await seedWidgetQuestions();
    const queries: WidgetQuery[] = [
      {
        id: "drafts",
        operation: "count",
        filterField: "status",
        filterOperator: "equals",
        filterValue: "draft",
      },
      { id: "byCategory", operation: "count", xAxisField: "categoryId", chartLimit: 20 },
      {
        id: "heavy",
        operation: "count",
        filterField: "usageCount",
        filterOperator: "gt",
        filterValue: "0",
      },
      {
        id: "prefix",
        operation: "count",
        filterField: "type",
        filterOperator: "startsWith",
        filterValue: "sh",
      },
      {
        id: "multi",
        operation: "count",
        filters: [
          { field: "difficulty", operator: "equals", value: "easy" },
          { field: "status", operator: "equals", value: "approved" },
        ],
      },
    ];

    const results = await aggregateQuestionBankWidgetQueries(TENANT, queries);
    expect(results.drafts?.value).toBeGreaterThanOrEqual(1);
    expect(results.byCategory?.chartData.map((bucket) => bucket.name)).toEqual(
      expect.arrayContaining(["fiqh", "history"]),
    );
    expect(results.heavy?.value).toBeGreaterThanOrEqual(1);
    expect(results.prefix?.value).toBeGreaterThanOrEqual(1);
    // The second rule narrows the first: only the approved easy question matches both.
    expect(results.multi?.value).toBe(1);
  });

  it("rejects an unsupported field instead of silently charting the wrong column", async () => {
    await expect(
      aggregateQuestionBankWidgetQueries(TENANT, [
        { id: "bad", operation: "count", filterField: "notAField", filterValue: "x" },
      ]),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("question taxonomy constraints", () => {
  const valid = {
    workspaceSubdomain: TENANT,
    type: "short",
    difficulty: "easy",
    questionLanguage: "en",
    text: "Taxonomy probe",
    answer: "a",
    marks: 1,
  };

  it("rejects values outside the shared type/difficulty/language lists (23514)", async () => {
    const invalidValues = [
      { type: "essay" },
      { difficulty: "extreme" },
      { questionLanguage: "fr" },
    ];
    for (const [index, override] of invalidValues.entries()) {
      const code = await pgCode(() =>
        withTenant(TENANT, (tx) =>
          tx.insert(questions).values({
            ...valid,
            ...override,
            id: `${TENANT}-taxonomy-bad-${index}`,
          }),
        ),
      );
      expect(code, JSON.stringify(override)).toBe("23514");
    }
  });
});

describe("published question snapshot", () => {
  it("stores a snapshot that parses with the shared schema", async () => {
    await withTenant(TENANT, (tx) =>
      tx
        .insert(testQuestions)
        .values({ workspaceSubdomain: TENANT, testId: TEST, questionId: QUESTION })
        .onConflictDoNothing(),
    );
    await setPaperPublished(TENANT, { testId: TEST, published: true, actorId: "u-publish" });

    const [row] = await withTenant(TENANT, (tx) =>
      tx
        .select({ snapshot: testQuestions.questionSnapshot })
        .from(testQuestions)
        .where(
          and(
            eq(testQuestions.workspaceSubdomain, TENANT),
            eq(testQuestions.testId, TEST),
            eq(testQuestions.questionId, QUESTION),
          ),
        ),
    );
    const parsed = questionBankQuestionSnapshotSchema.parse(row?.snapshot);
    expect(parsed.id).toBe(QUESTION);
    expect(parsed.options).toEqual(expect.any(Array));
  });
});
