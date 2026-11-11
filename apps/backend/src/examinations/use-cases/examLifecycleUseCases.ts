import { examEligibilityRepository as repo } from "../repository/examEligibilityAdapter.js";
import type { ExamLifecycleState } from "../repository/examEligibilityPort.js";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/httpErrors.js";

/**
 * Exam publication lifecycle — the administrative transitions that ordinary exam edits cannot make.
 *
 * `exams.status` and `exams.results_finalized_at` used to disagree: finalising forced
 * `status = 'completed'`, while re-opening cleared the stamp and left the status behind, so an
 * unpublished exam still read as completed in lists and metrics. Worse, finalisation had no
 * preconditions at all: it succeeded for a cancelled exam, for an exam nobody sat, and twice.
 *
 * The decision of what the next state is lives here (not in the repository and not in the route
 * handler); the repository only persists it. `publish` always lands on `completed`, `unpublish`
 * always lands back on `ongoing` — never on whatever the row happened to hold.
 *
 * See docs/examinations-domain-lifecycle-audit-2026-11-11.md.
 */

export interface ExamLifecycleResult {
  examId: string;
  resultsFinalizedAt: Date | null;
  status: string;
}

const UNPUBLISHABLE_SESSION_STATUS = "completed";

function lifecycleError(message: string, type: string): ConflictError {
  return new ConflictError(message, type);
}

async function requireState(tenant: string, examId: string): Promise<ExamLifecycleState> {
  const state = await repo.findExamLifecycleState(tenant, examId);
  if (!state) throw new NotFoundError("Exam not found");
  return state;
}

/**
 * Publishes (finalises) results: the exam was sat, marks are complete, and the results may now be
 * consumed by session completion. Publication freezes the marks and the exam's scoring frame.
 */
export async function publishExamResults(
  tenant: string,
  input: { examId: string; actorId: string; reason?: string | null },
): Promise<ExamLifecycleResult> {
  const state = await requireState(tenant, input.examId);

  if (state.deletedAt !== null) {
    throw lifecycleError(
      `Exam ${state.id} is archived — restore it before publishing its results`,
      "exam_archived",
    );
  }
  if (state.status === "cancelled") {
    throw lifecycleError(
      `Exam ${state.id} was cancelled — its results cannot be published`,
      "exam_cancelled",
    );
  }
  if (state.resultsFinalizedAt !== null) {
    throw lifecycleError(
      `Results for exam ${state.id} are already published`,
      "exam_already_published",
    );
  }

  const resultCount = await repo.countExamResultsForExam(tenant, input.examId);
  if (resultCount === 0) {
    throw lifecycleError(
      `Exam ${state.id} has no marks — record the marks before publishing results`,
      "exam_no_results",
    );
  }

  const written = await repo.setExamResultsFinalized(tenant, {
    examId: input.examId,
    resultsFinalizedAt: new Date(),
    status: "completed",
    actorId: input.actorId,
    reason: input.reason ?? null,
  });
  if (!written) throw new NotFoundError("Exam not found");
  return written;
}

/**
 * The explicit administrative unlock: re-opens published results.
 *
 * Requires a reason (it is the audit record of who unlocked marks and why) and is refused once a
 * session that owns the exam has been completed — completion already consumed the published marks
 * as evidence, so re-opening them afterwards would contradict a closed record.
 */
export async function unpublishExamResults(
  tenant: string,
  input: { examId: string; actorId: string; reason?: string | null },
): Promise<ExamLifecycleResult> {
  const reason = (input.reason ?? "").trim();
  if (reason.length < 3) {
    throw new ValidationError("A reason is required to unpublish exam results");
  }

  const state = await requireState(tenant, input.examId);
  if (state.resultsFinalizedAt === null) {
    throw lifecycleError(
      `Results for exam ${state.id} are not published — nothing to unlock`,
      "exam_not_published",
    );
  }

  const sessionStatuses = await repo.findOwningSessionStatuses(tenant, input.examId);
  if (sessionStatuses.includes(UNPUBLISHABLE_SESSION_STATUS)) {
    throw lifecycleError(
      `Exam ${state.id} belongs to a completed session — reopen the session before unlocking its published results`,
      "unpublish_blocked_session_completed",
    );
  }

  const written = await repo.setExamResultsFinalized(tenant, {
    examId: input.examId,
    resultsFinalizedAt: null,
    status: "ongoing",
    actorId: input.actorId,
    reason,
  });
  if (!written) throw new NotFoundError("Exam not found");
  return written;
}
