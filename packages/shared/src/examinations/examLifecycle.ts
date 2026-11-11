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
 * (0207/0222) and `completed` is the exam's delivered state; keeping them separate lets a delivered
 * exam be re-opened for moderation without rewinding its lifecycle. See
 * `docs/examinations-domain-lifecycle-audit-2026-11-11.md` for the 7-state target model.
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
