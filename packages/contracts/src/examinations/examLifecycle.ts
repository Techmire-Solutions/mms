/**
 * @file examLifecycle.ts
 * @description Pure examination lifecycle state machine — the single source of truth for which
 * exam statuses exist and which moves between them are legal.
 *
 * The backend enforces these transitions (`examinationExamsPersist.ts`) and the frontend uses the
 * same table to disable illegal options (`ExaminationFormFields.tsx`), so a rule can never drift
 * between the two. Domain only: no dates, no I/O, no tenant context.
 *
 * Publication is deliberately *not* a status. `exams.results_finalized_at` is the publication stamp
 * (0207/0222) and `completed` is the exam's delivered state. The administrative unlock clears the
 * stamp **and** returns the status to `ongoing` (see `UNPUBLISH_TARGET_STATUS`), because a delivered
 * exam whose results were re-opened must not keep reading as finalized in lists, metrics or the UI.
 * See `docs/examinations-domain-lifecycle-audit-2026-11-11-round2.md` for the state map.
 */

/** Every status value `exams.status` may hold (must match the DB CHECK added by migration 0236). */
export const EXAM_STATUSES = [
  "upcoming",
  "scheduled",
  "ongoing",
  "completed",
  "cancelled",
] as const;

export type ExamStatus = (typeof EXAM_STATUSES)[number];

/**
 * Legal moves for the generic exam upsert.
 *
 * `completed` and `cancelled` are terminal here on purpose: leaving `completed` (re-opening marks)
 * is an administrative unlock handled by `unpublishResults`, never by a bulk PUT. A same-state write
 * is always allowed — it is an update, not a transition.
 */
export const EXAM_STATUS_TRANSITIONS: Readonly<Record<ExamStatus, readonly ExamStatus[]>> = {
  upcoming: ["scheduled", "ongoing", "cancelled"],
  scheduled: ["ongoing", "cancelled"],
  ongoing: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

/** Terminal statuses: no outbound transition is legal through the generic write path. */
export const TERMINAL_EXAM_STATUSES: readonly ExamStatus[] = ["completed", "cancelled"];

export function isExamStatus(value: unknown): value is ExamStatus {
  return typeof value === "string" && (EXAM_STATUSES as readonly string[]).includes(value);
}

/** Statuses a caller may move `from` into. Unknown input yields an empty list (fail closed). */
export function allowedNextStatuses(from: string | null | undefined): readonly ExamStatus[] {
  if (!isExamStatus(from)) return [];
  return EXAM_STATUS_TRANSITIONS[from];
}

/**
 * Whether `from → to` is a legal transition.
 *
 * A no-op (`from === to`) is legal; an unknown source or target status is not (fail closed, so a
 * corrupt or legacy value cannot be "migrated" by a routine save).
 */
export function canTransitionExam(
  from: string | null | undefined,
  to: string | null | undefined,
): boolean {
  if (!isExamStatus(to)) return false;
  if (from === null || from === undefined) return true; // creating a row: every valid status is allowed
  if (!isExamStatus(from)) return false;
  if (from === to) return true;
  return EXAM_STATUS_TRANSITIONS[from].includes(to);
}

/** Whether results are published (immutable) for this exam. */
export function isExamPublished(exam: { resultsFinalizedAt?: string | Date | null }): boolean {
  return exam.resultsFinalizedAt !== null && exam.resultsFinalizedAt !== undefined;
}

/** Whether the exam row is soft-deleted (archived). Archived exams are immutable until restored. */
export function isExamArchived(exam: { deletedAt?: string | Date | null }): boolean {
  return exam.deletedAt !== null && exam.deletedAt !== undefined;
}

/**
 * Statuses from which results may be published.
 *
 * An exam nobody has sat (`upcoming`/`scheduled`) cannot have final results: publishing it used to
 * be possible and wrote `completed` directly, a move the ordinary transition table declares illegal.
 */
export const PUBLISHABLE_EXAM_STATUSES = ["ongoing", "completed"] as const;

export function isPublishableExamStatus(value: unknown): value is ExamStatus {
  return (
    typeof value === "string" && (PUBLISHABLE_EXAM_STATUSES as readonly string[]).includes(value)
  );
}

/** The status a successful publication lands on. Publication itself is the stamp. */
export const PUBLISH_TARGET_STATUS: ExamStatus = "completed";

/**
 * The status the administrative unlock returns to.
 *
 * Deliberately `ongoing`, not the pre-publication status: an unpublished exam must not keep
 * reading as delivered (round-1 F8), so clearing the stamp and rewinding the delivered state are
 * one operation. The raw marks stay in place and are audited.
 */
export const UNPUBLISH_TARGET_STATUS: ExamStatus = "ongoing";

/** The subset of an exam the publication rules read. */
export interface ExamPublicationState {
  status?: string | null;
  resultsFinalizedAt?: string | Date | null;
  deletedAt?: string | Date | null;
}

/** Why `publishExamResults` must refuse; `null` means the publish is legal. */
export type PublishRejection = "archived" | "cancelled" | "already_published" | "not_sat";

/** Why the administrative unlock must refuse; `null` means the unlock is legal. */
export type UnpublishRejection = "archived" | "not_published";

/**
 * Publication preconditions, in the order the UI should report them.
 *
 * This is the single authority for "may these results be published": the use case, the UI message
 * mapping and the DB-state CAS all derive from it, so the transition table and the administrative
 * path can no longer disagree.
 */
export function publishExamRejection(state: ExamPublicationState): PublishRejection | null {
  if (isExamArchived(state)) return "archived";
  if (state.status === "cancelled") return "cancelled";
  if (isExamPublished(state)) return "already_published";
  if (!isPublishableExamStatus(state.status)) return "not_sat";
  return null;
}

/** The administrative-unlock preconditions (publication is the only thing it may clear). */
export function unpublishExamRejection(state: ExamPublicationState): UnpublishRejection | null {
  if (isExamArchived(state)) return "archived";
  if (!isExamPublished(state)) return "not_published";
  return null;
}

/**
 * Whether the exam is locked against ordinary edits: published results or a cancelled sitting.
 * Locked exams may still be un-published / restored through the administrative unlock path.
 */
export function isExamLocked(exam: {
  status?: string | null;
  resultsFinalizedAt?: string | Date | null;
}): boolean {
  return isExamPublished(exam) || exam.status === "cancelled";
}
