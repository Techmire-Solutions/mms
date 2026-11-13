import {
  canTransitionQuestion,
  isQuestionContentLocked,
  type QuestionInvariantIssue,
} from "@mms/shared";
import { ConflictError, HttpDomainError } from "../../lib/httpErrors.js";

/**
 * Pure write guards for the question aggregate.
 *
 * These are domain rules, not persistence concerns, but they must run inside the same transaction as
 * the write that they guard — so they live here as pure functions that the repository calls after
 * reading the current row (the `examWriteGuards.ts` pattern). Route handlers own transport and
 * authorization only.
 *
 * Integration: questions have no lifecycle (`status`) until migration 0241, so nothing stopped an
 * edit of a question that a delivered paper already grades. See
 * docs/question-bank-domain-lifecycle-audit-2026-11-11.md.
 */

/** The persisted state the guards need. */
export interface QuestionGuardState {
  id: string;
  status: string;
  /** Referenced by a published paper or one that already has results. */
  referenced: boolean;
}

export function questionContentLockedError(questionId: string, status: string): ConflictError {
  return new ConflictError(
    `Question ${questionId} is ${status} — reopen it to draft before changing its text, options, answer or marks`,
    "question_locked",
    { questionId, status },
  );
}

export function illegalQuestionTransitionError(
  questionId: string,
  from: string,
  to: string,
): ConflictError {
  return new ConflictError(
    `Question status cannot move from "${from}" to "${to}"`,
    "illegal_question_transition",
    { questionId, from, to },
  );
}

export function questionInUseError(questionId: string, action: string): ConflictError {
  return new ConflictError(
    `Question ${questionId} is used by a delivered paper — ${action} is blocked; duplicate it to create a revision`,
    "question_in_use",
    { questionId, action },
  );
}

export function paperLockedError(testId: string): ConflictError {
  return new ConflictError(
    `Paper ${testId} is published — its question set cannot change; unpublish it first`,
    "paper_locked",
    { testId },
  );
}

export function paperNotFoundError(testId: string): ConflictError {
  return new ConflictError(`Paper ${testId} has no questions to publish`, "paper_empty", {
    testId,
  });
}

/** One invariant violation per field, with the translation key the form already uses. */
export function questionInvariantsError(
  recordId: string,
  issues: readonly QuestionInvariantIssue[],
): HttpDomainError {
  return new HttpDomainError(400, "question_invariants", `Question ${recordId} is not valid`, {
    details: {
      recordId,
      issues: issues.map((issue) => ({
        path: issue.path,
        code: issue.code,
        messageKey: issue.messageKey,
      })),
    },
  });
}

/**
 * Content edits: allowed while the question is still being authored, blocked once it is approved or
 * retired, and blocked unconditionally once a delivered paper references it (a reopen cannot rescue
 * that — the historical paper must keep resolving to the content it was delivered with).
 *
 * Metadata-only writes (difficulty, language, categories, citations) pass, so housekeeping does not
 * require a full review cycle.
 */
export function assertQuestionEditable(
  state: QuestionGuardState,
  options: { contentChanged: boolean },
): void {
  if (!options.contentChanged) return;
  if (state.referenced) throw questionInUseError(state.id, "editing it");
  if (isQuestionContentLocked(state.status)) {
    throw questionContentLockedError(state.id, state.status);
  }
}

/** Status transitions: the shared table decides legality; a referenced question cannot be reopened. */
export function assertQuestionTransition(input: {
  id: string;
  from: string;
  to: string;
  referenced: boolean;
}): void {
  const { id, from, to, referenced } = input;
  if (!canTransitionQuestion(from, to)) throw illegalQuestionTransitionError(id, from, to);
  if (referenced && (to === "draft" || to === "under_review")) {
    throw questionInUseError(id, `reopening it to ${to}`);
  }
}

/** Paper composition is frozen once published (question set, sections and their order). */
export function assertPaperCompositionEditable(input: {
  testId: string;
  publishedAt: Date | null;
  compositionChanged: boolean;
}): void {
  if (input.compositionChanged && input.publishedAt) throw paperLockedError(input.testId);
}
