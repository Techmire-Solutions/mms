import { canTransitionExam, isExamPublished } from "@mms/shared";
import { ConflictError } from "../../lib/httpErrors.js";

/**
 * Pure write guards for the exam aggregate.
 *
 * These are domain rules, not persistence concerns, but they must run inside the same transaction
 * as the write that they guard — so they live here as pure functions that the repository calls
 * after reading the current row. Route handlers own transport and authorization only.
 *
 * Lifecycle background: `exams.status` was previously copied from the request verbatim, so any
 * state could follow any other, and a published exam (results finalized) could still be re-dated,
 * re-weighted or re-classed. See docs/examinations-domain-lifecycle-audit-2026-11-11-round2.md.
 */

/** The current persisted state the guards need. */
export interface ExamWriteState {
  status: string;
  resultsFinalizedAt: Date | null;
  /** Soft-delete marker; an archived exam is read-only until it is restored. */
  deletedAt: Date | null;
  name: string;
  subjectId: string | null;
  totalMarks: number;
  passingMarks: number;
  date: string | null;
  duration: number;
  classIds: readonly string[];
}

/** The incoming record, narrowed to the guarded fields. */
export interface ExamWriteIntent {
  status?: string | null;
  subjectId?: string | null;
  name: string;
  totalMarks: number;
  passingMarks: number;
  date: string | null;
  duration: number;
  classIds: readonly string[];
}

export function illegalExamTransitionError(from: string, to: string): ConflictError {
  return new ConflictError(
    `Exam status cannot move from "${from}" to "${to}" — reopen or archive it through the lifecycle actions instead`,
    "illegal_exam_transition",
    { from, to },
  );
}

export function examPublishedImmutableError(examId: string): ConflictError {
  return new ConflictError(
    `Exam ${examId} has published results — unpublish them (administrative unlock) before changing its schedule, subject, classes or marks`,
    "exam_published_immutable",
    { examId },
  );
}

export function examPublishedDeleteError(examId: string): ConflictError {
  return new ConflictError(
    `Exam ${examId} has published results — unpublish them before deleting the exam`,
    "unpublish_first",
    { examId },
  );
}

export function examArchivedError(examId: string): ConflictError {
  return new ConflictError(
    `Exam ${examId} is archived — restore it before editing its schedule, marks or classes`,
    "exam_archived",
    { examId },
  );
}

/**
 * Archived (soft-deleted) exams are read-only.
 *
 * The single-row update path already refused archived rows (`genericRelationalService`); the bulk
 * upsert that the UI actually uses did not, so a trashed exam could be re-dated or moved through
 * the lifecycle. Both paths now share this guard.
 */
export function assertExamNotArchived(examId: string, state: { deletedAt: Date | null }): void {
  if (state.deletedAt !== null) throw examArchivedError(examId);
}

/**
 * Rejects an illegal status move. A missing previous row means "create", where any valid status is
 * allowed; an unknown persisted status fails closed (it is never silently rewritten).
 */
export function assertExamTransitionAllowed(
  existing: { status: string } | null | undefined,
  nextStatus: string | null | undefined,
): void {
  if (!existing) return;
  const to = nextStatus ?? existing.status;
  if (!canTransitionExam(existing.status, to)) {
    throw illegalExamTransitionError(existing.status, String(to));
  }
}

function sameStringSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((value, index) => value === right[index]);
}

/**
 * Published results freeze the exam's identity and scoring frame. Description is deliberately not
 * guarded (notes are harmless), everything that changes what a mark means is.
 */
export function assertPublishedExamImmutable(
  examId: string,
  existing: ExamWriteState,
  incoming: ExamWriteIntent,
): void {
  if (!isExamPublished(existing)) return;
  const changed =
    incoming.name !== existing.name ||
    (incoming.subjectId ?? null) !== (existing.subjectId ?? null) ||
    incoming.totalMarks !== existing.totalMarks ||
    incoming.passingMarks !== existing.passingMarks ||
    (incoming.date ?? null) !== (existing.date ?? null) ||
    incoming.duration !== existing.duration ||
    (incoming.status ?? existing.status) !== existing.status ||
    !sameStringSet(incoming.classIds, existing.classIds);
  if (changed) throw examPublishedImmutableError(examId);
}

/** A published exam must be unpublished before it can be trashed. */
export function assertExamDeletable(
  examId: string,
  state: { resultsFinalizedAt: Date | null },
): void {
  if (state.resultsFinalizedAt !== null) throw examPublishedDeleteError(examId);
}
