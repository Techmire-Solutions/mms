import { and, eq, exists, inArray, isNotNull, or } from "drizzle-orm";
import {
  normalizeQuestionBankQuestion,
  validateQuestionByType,
  type QuestionBankQuestion,
} from "@mms/shared";
import {
  assessmentResults,
  questions,
  testQuestions,
  testSectionQuestions,
  testSections,
  tests,
} from "../schema.js";
import type { TenantTransaction } from "../tenant-context.js";
import {
  assertQuestionEditable,
  questionInvariantsError,
} from "../../questionBank/domain/questionWriteGuards.js";
import { questionStaleWriteError } from "./questionBankQuestionUpsert.js";
import { hydrateQuestionRecords, questionRowColumns } from "./questionBankQuestionsSync.js";

/**
 * Builds the authoritative write plan for a bulk question save, inside the caller's transaction.
 *
 * Why this exists: the live bulk PUT used to persist the client's payload verbatim. That meant
 *   - server-owned fields the form does not carry (`marks`, `tags`, restore evidence) were reset,
 *   - type rules were never enforced (only the browser form had any),
 *   - and every row in the collection was rewritten, bumping OCC tokens for untouched questions.
 *
 * The plan fixes all three: unchanged rows are skipped, metadata-only edits bypass the content
 * guards, and content edits are normalized, validated and guarded against the stored state.
 */

export interface QuestionWriteChange {
  readonly id: string;
  readonly isNew: boolean;
  /** Stored state before the write (absent for a creation). */
  readonly before?: QuestionBankQuestion;
  readonly after: QuestionBankQuestion;
}

export interface QuestionWritePlan {
  /** Rows that actually differ; the persist layer writes only these. */
  readonly changed: QuestionBankQuestion[];
  /** Ids of unchanged rows. */
  readonly unchanged: string[];
  /** Per-row before/after state for the transactional audit rows. */
  readonly changes: QuestionWriteChange[];
}

function stableJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function sortedJson(value: readonly string[] | undefined): string {
  return JSON.stringify([...(value ?? [])].sort());
}

/** Fields whose change requires the question to be editable (guarded by lifecycle + usage). */
function contentChanged(incoming: QuestionBankQuestion, stored: QuestionBankQuestion): boolean {
  if (incoming.type !== stored.type) return true;
  if ((incoming.text ?? "") !== (stored.text ?? "")) return true;
  if ((incoming.answer ?? "") !== (stored.answer ?? "")) return true;
  if ((incoming.marks ?? 1) !== (stored.marks ?? 1)) return true;
  return stableJson(incoming.options) !== stableJson(stored.options);
}

function anythingChanged(incoming: QuestionBankQuestion, stored: QuestionBankQuestion): boolean {
  if (contentChanged(incoming, stored)) return true;
  if ((incoming.difficulty ?? "") !== (stored.difficulty ?? "")) return true;
  if ((incoming.questionLanguage ?? "") !== (stored.questionLanguage ?? "")) return true;
  if (sortedJson(incoming.categoryIds) !== sortedJson(stored.categoryIds)) return true;
  if (sortedJson(incoming.tags) !== sortedJson(stored.tags)) return true;
  if (stableJson(incoming.sourceCitations) !== stableJson(stored.sourceCitations)) return true;
  return (incoming.deletedAt ?? null) !== (stored.deletedAt ?? null);
}

/**
 * Ids of questions referenced by a delivered paper — one that is published **or** already has
 * results. This mirrors the DB guard (`question_bank_guard_referenced_question`, 0241) so the API
 * refuses with a domain error before the trigger fires.
 */
export async function findReferencedQuestionIds(
  tx: TenantTransaction,
  subdomain: string,
  questionIds: readonly string[],
): Promise<Set<string>> {
  if (questionIds.length === 0) return new Set();

  const deliveredTest = or(
    isNotNull(tests.publishedAt),
    exists(
      tx
        .select({ one: assessmentResults.id })
        .from(assessmentResults)
        .where(
          and(
            eq(assessmentResults.workspaceSubdomain, tests.workspaceSubdomain),
            eq(assessmentResults.testId, tests.id),
          ),
        ),
    ),
  );

  const [directRows, sectionRows] = await Promise.all([
    tx
      .selectDistinct({ questionId: testQuestions.questionId })
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
          inArray(testQuestions.questionId, [...questionIds]),
          deliveredTest,
        ),
      ),
    tx
      .selectDistinct({ questionId: testSectionQuestions.questionId })
      .from(testSectionQuestions)
      .innerJoin(
        testSections,
        and(
          eq(testSections.workspaceSubdomain, testSectionQuestions.workspaceSubdomain),
          eq(testSections.id, testSectionQuestions.sectionId),
        ),
      )
      .innerJoin(
        tests,
        and(
          eq(tests.workspaceSubdomain, testSections.workspaceSubdomain),
          eq(tests.id, testSections.testId),
        ),
      )
      .where(
        and(
          eq(testSectionQuestions.workspaceSubdomain, subdomain),
          inArray(testSectionQuestions.questionId, [...questionIds]),
          deliveredTest,
        ),
      ),
  ]);

  return new Set([
    ...directRows.map((row) => row.questionId),
    ...sectionRows.map((row) => row.questionId),
  ]);
}

/**
 * Load stored state, merge server-owned fields, and produce the rows to write.
 *
 * @throws HttpDomainError (400 `question_invariants`) for an invalid changed question
 * @throws ConflictError (409 `question_locked` / `question_in_use`) for a locked or referenced one
 */
export async function buildQuestionWritePlan(
  tx: TenantTransaction,
  subdomain: string,
  incoming: readonly QuestionBankQuestion[],
): Promise<QuestionWritePlan> {
  if (incoming.length === 0) return { changed: [], unchanged: [], changes: [] };

  const ids = [...new Set(incoming.map((record) => record.id.trim()).filter(Boolean))];
  const storedRows = await tx
    .select(questionRowColumns)
    .from(questions)
    .where(and(eq(questions.workspaceSubdomain, subdomain), inArray(questions.id, ids)))
    .for("update");

  const storedRecords = await hydrateQuestionRecords(tx, subdomain, storedRows);
  const storedById = new Map(storedRecords.map((record) => [record.id, record]));

  const referenced = await findReferencedQuestionIds(tx, subdomain, [...storedById.keys()]);

  const changed: QuestionBankQuestion[] = [];
  const unchanged: string[] = [];
  const changes: QuestionWriteChange[] = [];

  for (const record of incoming) {
    const stored = storedById.get(record.id);

    // A brand-new question: normalize, validate, and let the lifecycle default to `draft`.
    if (!stored) {
      const normalized = normalizeQuestionBankQuestion({
        ...record,
        categoryIds: record.categoryIds ?? [],
      });
      const issues = validateQuestionByType(normalized);
      if (issues.length > 0) throw questionInvariantsError(record.id, issues);
      changed.push(normalized);
      changes.push({ id: normalized.id, isNew: true, after: normalized });
      continue;
    }

    // A token that no longer matches is a conflict even when the content happens to look identical:
    // the caller is editing a version that no longer exists.
    if (typeof record.version === "number" && record.version !== stored.version) {
      throw questionStaleWriteError(record);
    }

    // Server-owned fields the form does not carry are preserved, never reset.
    const merged: QuestionBankQuestion = {
      ...record,
      marks: record.marks ?? stored.marks,
      tags: record.tags ?? stored.tags,
      restoredAt: record.restoredAt ?? stored.restoredAt ?? null,
      restoredBy: record.restoredBy ?? stored.restoredBy ?? null,
      deletedWithCascade: record.deletedWithCascade ?? stored.deletedWithCascade ?? false,
      version: record.version ?? stored.version,
    };

    if (!anythingChanged(merged, stored)) {
      unchanged.push(record.id);
      continue;
    }

    const normalized = normalizeQuestionBankQuestion({
      ...merged,
      categoryIds: merged.categoryIds ?? stored.categoryIds,
    });

    if (contentChanged(normalized, stored)) {
      const issues = validateQuestionByType(normalized);
      if (issues.length > 0) throw questionInvariantsError(record.id, issues);
      assertQuestionEditable(
        {
          id: stored.id,
          status: String(stored.status ?? "draft"),
          referenced: referenced.has(stored.id),
        },
        { contentChanged: true },
      );
    }

    changed.push(normalized);
    changes.push({ id: normalized.id, isNew: false, before: stored, after: normalized });
  }

  return { changed, unchanged, changes };
}
