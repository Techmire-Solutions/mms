/**
 * @file questionLifecycle.ts
 * @description Pure Question Bank lifecycle state machine — the single source of truth for which
 * question statuses exist and which moves between them are legal.
 *
 * The backend enforces these transitions (`questionBankLifecyclePersist.ts` + the question write
 * guards) and the frontend uses the same table to disable illegal actions, so a rule cannot drift
 * between the two. Domain only: no dates, no I/O, no tenant context.
 *
 * The statuses are the authoring workflow: a question is written (`draft`), submitted for review
 * (`under_review`), accepted for use in papers (`approved`), and taken out of circulation
 * (`retired`). `approved` and `retired` are content-locked: changing the stem, options or answer key
 * requires reopening to `draft` first, and a question already referenced by a published paper can
 * never be reopened (the historical paper must keep resolving to the content it was delivered with).
 */

import { QUESTION_STATUSES, type QuestionStatus } from "./questionTaxonomy.js";

export { QUESTION_STATUSES, type QuestionStatus } from "./questionTaxonomy.js";

/**
 * Legal moves for the generic status transition endpoint.
 *
 * A same-state write is always allowed — it is an update, not a transition. `retired` is not
 * terminal: a retired question may be reopened for a correction.
 */
export const QUESTION_STATUS_TRANSITIONS: Readonly<
  Record<QuestionStatus, readonly QuestionStatus[]>
> = {
  draft: ["under_review", "retired"],
  under_review: ["approved", "draft", "retired"],
  approved: ["retired"],
  retired: ["draft"],
};

/** Statuses whose content (stem/options/answer) is frozen until the question is reopened. */
export const QUESTION_CONTENT_LOCKED_STATUSES: readonly QuestionStatus[] = ["approved", "retired"];

/** Statuses a caller may move `from` into. Unknown input yields an empty list (fail closed). */
export function allowedNextQuestionStatuses(
  from: string | null | undefined,
): readonly QuestionStatus[] {
  if (!isQuestionStatus(from)) return [];
  return QUESTION_STATUS_TRANSITIONS[from];
}

export function isQuestionStatus(value: unknown): value is QuestionStatus {
  return typeof value === "string" && (QUESTION_STATUSES as readonly string[]).includes(value);
}

/**
 * Whether `from → to` is a legal transition.
 *
 * A no-op (`from === to`) is legal; an unknown source or target status is not (fail closed, so a
 * corrupt or legacy value cannot be "migrated" by a routine save).
 */
export function canTransitionQuestion(
  from: string | null | undefined,
  to: string | null | undefined,
): boolean {
  if (!isQuestionStatus(to)) return false;
  if (from === null || from === undefined) return true; // creating a row: every valid status is allowed
  if (!isQuestionStatus(from)) return false;
  if (from === to) return true;
  return QUESTION_STATUS_TRANSITIONS[from].includes(to);
}

/** Whether the question's content is frozen in this status. */
export function isQuestionContentLocked(status: string | null | undefined): boolean {
  return isQuestionStatus(status) && QUESTION_CONTENT_LOCKED_STATUSES.includes(status);
}

/**
 * Whether a move needs approval authority rather than ordinary write authority.
 *
 * Accepting a question into circulation (`approved`) and taking it out (`retired`) are the two
 * states papers may consume, so they are gated one step above authoring.
 */
export function requiresQuestionApprovalAuthority(to: string | null | undefined): boolean {
  return to === "approved" || to === "retired";
}
