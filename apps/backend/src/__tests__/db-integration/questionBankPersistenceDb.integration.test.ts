import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { beginLongLivedTenantTransaction, closeDatabase } from "../../db/dbConnection.js";
import { withTenant } from "../../db/tenant-context.js";
import {
  assessmentAnswers,
  assessmentResults,
  questions,
  sessionClasses,
  sessions,
  students,
  testSectionQuestions,
  testSections,
  tests,
  workspaces,
} from "../../db/schema.js";
import { extractPgErrorCode, requireDatabaseConnection, uniqueTenant } from "./dbTestSupport.js";

/**
 * Real-Postgres regression suite for the "exam paper" persistence layer added by migration 0238
 * (docs/examinations-schema-persistence-audit-2026-11-11-round2.md):
 *   - `tests` / `questions` / `assessment_answers` / `assessment_results` domain checks;
 *   - `test_section_questions.section_id -> test_sections` (cascade on section delete);
 *   - one active paper result per `(workspace, test, student)`, recyclable through soft delete;
 *   - the declared `assessment_results_workspace_submitted_idx` and `tests_class_fk` really exist.
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
      type: "short_answer",
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
