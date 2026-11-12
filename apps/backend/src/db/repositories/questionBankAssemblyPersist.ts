import { and, asc, eq, gte, inArray, isNull, notExists, sql } from "drizzle-orm";
import {
  assemblePaperBlueprint,
  BLUEPRINT_LIMITS,
  type BlueprintCandidate,
  type BlueprintResult,
  type PaperBlueprint,
} from "@mms/shared";
import {
  questionCategories,
  questions,
  testBlueprintBuckets,
  testQuestions,
  testSectionQuestions,
  testSections,
  tests,
} from "../schema.js";
import { withTenant, type TenantTransaction } from "../tenant-context.js";
import { ConflictError, NotFoundError } from "../../lib/httpErrors.js";
import { auditQuestionBankEntity } from "./questionBankAudit.js";

/**
 * Deterministic paper assembly (migration 0242).
 *
 * Everything that matters runs inside one transaction with the paper row locked: a published paper
 * cannot be re-assembled, and two concurrent assembly requests cannot interleave their links.
 * Candidate loading is a fixed two-query batch — never a query per bucket or per question.
 */

/** Questions used by a paper created within the window are not eligible. */
async function loadAssemblyCandidates(
  tx: TenantTransaction,
  subdomain: string,
  excludeRecentlyUsedDays: number,
): Promise<BlueprintCandidate[]> {
  const cutoff =
    excludeRecentlyUsedDays > 0
      ? new Date(Date.now() - excludeRecentlyUsedDays * 24 * 60 * 60 * 1000)
      : null;

  const rows = await tx
    .select({
      id: questions.id,
      difficulty: questions.difficulty,
      type: questions.type,
      marks: questions.marks,
    })
    .from(questions)
    .where(
      and(
        eq(questions.workspaceSubdomain, subdomain),
        isNull(questions.deletedAt),
        eq(questions.status, "approved"),
        cutoff
          ? notExists(
              tx
                .select({ one: testQuestions.questionId })
                .from(testQuestions)
                .innerJoin(
                  tests,
                  and(
                    eq(tests.workspaceSubdomain, testQuestions.workspaceSubdomain),
                    eq(tests.id, testQuestions.testId),
                  ),
                )
                .where(
                  and(
                    eq(testQuestions.workspaceSubdomain, subdomain),
                    eq(testQuestions.questionId, questions.id),
                    gte(tests.createdAt, cutoff),
                  ),
                ),
            )
          : sql`true`,
      ),
    )
    .orderBy(asc(questions.id))
    .limit(BLUEPRINT_LIMITS.maxCandidates);

  if (rows.length === 0) return [];

  const categoryRows = await tx
    .select({
      questionId: questionCategories.questionId,
      categoryId: questionCategories.categoryId,
    })
    .from(questionCategories)
    .where(
      and(
        eq(questionCategories.workspaceSubdomain, subdomain),
        inArray(
          questionCategories.questionId,
          rows.map((row) => row.id),
        ),
      ),
    );
  const categoriesByQuestion = new Map<string, string[]>();
  for (const row of categoryRows) {
    const list = categoriesByQuestion.get(row.questionId) ?? [];
    list.push(row.categoryId);
    categoriesByQuestion.set(row.questionId, list);
  }

  return rows.map((row) => ({
    id: row.id,
    difficulty: row.difficulty as BlueprintCandidate["difficulty"],
    type: row.type as BlueprintCandidate["type"],
    marks: row.marks,
    categoryIds: categoriesByQuestion.get(row.id) ?? [],
  }));
}

export interface AssemblyOutcome {
  result: BlueprintResult;
  questionIds: string[];
}

/** Run the engine for one paper and persist the selection, the blueprint and the seed. */
export async function assemblePaperForTest(
  tenant: string,
  input: { testId: string; blueprint: PaperBlueprint; actorId?: string | null },
): Promise<AssemblyOutcome> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const [paper] = await tx
      .select({ id: tests.id, publishedAt: tests.publishedAt, deletedAt: tests.deletedAt })
      .from(tests)
      .where(and(eq(tests.workspaceSubdomain, subdomain), eq(tests.id, input.testId)))
      .for("update");
    if (!paper) throw new NotFoundError(`Paper ${input.testId} not found`);
    if (paper.deletedAt) {
      throw new ConflictError(
        `Paper ${input.testId} is archived — restore it before assembling`,
        "paper_archived",
        { testId: input.testId },
      );
    }
    if (paper.publishedAt) {
      throw new ConflictError(
        `Paper ${input.testId} is published — its question set is frozen`,
        "paper_locked",
        { testId: input.testId },
      );
    }

    const candidates = await loadAssemblyCandidates(
      tx,
      subdomain,
      input.blueprint.excludeRecentlyUsedDays,
    );
    const result = assemblePaperBlueprint({
      blueprint: input.blueprint,
      candidates,
      seed: input.testId,
    });
    const questionIds = result.selected.map((row) => row.questionId);

    const sectionRows = await tx
      .select({ id: testSections.id })
      .from(testSections)
      .where(
        and(eq(testSections.workspaceSubdomain, subdomain), eq(testSections.testId, input.testId)),
      );

    await tx
      .delete(testQuestions)
      .where(
        and(
          eq(testQuestions.workspaceSubdomain, subdomain),
          eq(testQuestions.testId, input.testId),
        ),
      );
    if (sectionRows.length > 0) {
      await tx.delete(testSectionQuestions).where(
        and(
          eq(testSectionQuestions.workspaceSubdomain, subdomain),
          inArray(
            testSectionQuestions.sectionId,
            sectionRows.map((row) => row.id),
          ),
        ),
      );
    }

    if (questionIds.length > 0) {
      await tx.insert(testQuestions).values(
        questionIds.map((questionId, index) => ({
          workspaceSubdomain: subdomain,
          testId: input.testId,
          questionId,
          sortOrder: index,
        })),
      );
    }

    await tx
      .delete(testBlueprintBuckets)
      .where(
        and(
          eq(testBlueprintBuckets.workspaceSubdomain, subdomain),
          eq(testBlueprintBuckets.testId, input.testId),
        ),
      );
    await tx.insert(testBlueprintBuckets).values(
      input.blueprint.buckets.map((bucket, index) => ({
        workspaceSubdomain: subdomain,
        testId: input.testId,
        bucketIndex: index,
        categoryId: bucket.categoryId ?? null,
        difficulty: bucket.difficulty ?? null,
        type: bucket.type ?? null,
        targetCount: bucket.count ?? null,
        targetMarks: bucket.marks ?? null,
      })),
    );

    await tx
      .update(tests)
      .set({ assemblySeed: result.seedUsed, updatedAt: new Date() })
      .where(and(eq(tests.workspaceSubdomain, subdomain), eq(tests.id, input.testId)));

    await auditQuestionBankEntity(tx, {
      subdomain,
      tableName: "tests",
      recordId: input.testId,
      actionType: "UPDATE",
      actorId: input.actorId ?? null,
      newState: {
        seed: result.seedUsed,
        selected: questionIds.length,
        totalMarks: result.totalMarks,
        deficits: result.deficits,
      },
    });

    return { result, questionIds };
  });
}
