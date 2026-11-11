import {
  PUBLISH_TARGET_STATUS,
  UNPUBLISH_TARGET_STATUS,
  publishExamRejection,
  unpublishExamRejection,
  type PublishRejection,
  type UnpublishRejection,
} from "@mms/shared";
import { examEligibilityRepository as repo } from "../repository/examEligibilityAdapter.js";
import type { ExamLifecycleState } from "../repository/examEligibilityPort.js";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/httpErrors.js";

/**
 * Exam publication lifecycle — the administrative transitions that ordinary exam edits cannot make.
 *
 * `exams.status` and `exams.results_finalized_at` used to disagree: finalising forced
 * `status = 'completed'`, while re-opening cleared the stamp and left the status behind, so an
 * unpublished exam still read as completed in lists and metrics. Publication also had no
 * preconditions: it succeeded for a cancelled exam, for an exam nobody sat, and twice.
 *
 * The *decision* of what the next state is lives in the shared state machine (`publishExamRejection`
 * / `unpublishExamRejection`); this use case maps those rejections to HTTP conflicts. `publish`
 * always lands on `completed`, `unpublish` always lands back on `ongoing` — never on whatever the
 * row happened to hold.
 *
 * See docs/examinations-domain-lifecycle-audit-2026-11-11-round2.md.
 */

export interface ExamLifecycleResult {
  examId: string;
  resultsFinalizedAt: Date | null;
  status: string;
}

const UNPUBLISHABLE_SESSION_STATUS = "completed";

function lifecycleError(
  message: string,
  type: string,
  details?: Record<string, unknown>,
): ConflictError {
  return new ConflictError(message, type, details);
}

function publishError(rejection: PublishRejection, examId: string): ConflictError {
  switch (rejection) {
    case "archived":
      return lifecycleError(
        `Exam ${examId} is archived — restore it before publishing its results`,
        "exam_archived",
        { examId },
      );
    case "cancelled":
      return lifecycleError(
        `Exam ${examId} was cancelled — its results cannot be published`,
        "exam_cancelled",
        { examId },
      );
    case "already_published":
      return lifecycleError(
        `Results for exam ${examId} are already published`,
        "exam_already_published",
        { examId },
      );
    case "not_sat":
      return lifecycleError(
        `Exam ${examId} has not been sat yet — move it to ongoing or completed before publishing results`,
        "exam_not_sat",
        { examId },
      );
  }
}

function unpublishError(rejection: UnpublishRejection, examId: string): ConflictError {
  switch (rejection) {
    case "archived":
      return lifecycleError(
        `Exam ${examId} is archived — restore it before unlocking its results`,
        "exam_archived",
        { examId },
      );
    case "not_published":
      return lifecycleError(
        `Results for exam ${examId} are not published — nothing to unlock`,
        "exam_not_published",
        { examId },
      );
  }
}

function completedSessionError(examId: string): ConflictError {
  return lifecycleError(
    `Exam ${examId} belongs to a completed session — reopen the session before unlocking its published results`,
    "unpublish_blocked_session_completed",
    { examId },
  );
}

async function requireState(tenant: string, examId: string): Promise<ExamLifecycleState> {
  const state = await repo.findExamLifecycleState(tenant, examId);
  if (!state) throw new NotFoundError("Exam not found");
  return state;
}

async function ownsCompletedSession(tenant: string, examId: string): Promise<boolean> {
  const sessionStatuses = await repo.findOwningSessionStatuses(tenant, examId);
  return sessionStatuses.includes(UNPUBLISHABLE_SESSION_STATUS);
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
  const rejection = publishExamRejection(state);
  if (rejection) throw publishError(rejection, state.id);

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
    status: PUBLISH_TARGET_STATUS,
    actorId: input.actorId,
    reason: input.reason ?? null,
    // Compare-and-set: the stamp and the publishable state must still hold at write time.
    expect: "unpublished",
    require: "publishable",
  });
  if (!written) {
    // Lost the compare-and-set (state moved between the read and the write). Re-read once so the
    // caller is told exactly why instead of a generic race message.
    const latest = await requireState(tenant, input.examId);
    const latestRejection = publishExamRejection(latest);
    if (latestRejection) throw publishError(latestRejection, latest.id);
    throw lifecycleError(
      `Exam ${latest.id} changed while publishing — reload and retry`,
      "exam_state_changed",
    );
  }
  return written;
}

/**
 * The explicit administrative unlock: re-opens published results.
 *
 * Requires a reason (it is the audit record of who unlocked marks and why) and is refused once a
 * session that owns the exam has been completed — completion already consumed the published marks
 * as evidence, so re-opening them afterwards would contradict a closed record. Archived exams must
 * be restored first; the CAS repeats the state/session checks atomically at write time.
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
  const rejection = unpublishExamRejection(state);
  if (rejection) throw unpublishError(rejection, state.id);

  if (await ownsCompletedSession(tenant, input.examId)) {
    throw completedSessionError(state.id);
  }

  const written = await repo.setExamResultsFinalized(tenant, {
    examId: input.examId,
    resultsFinalizedAt: null,
    status: UNPUBLISH_TARGET_STATUS,
    actorId: input.actorId,
    reason,
    // Compare-and-set: only clears the stamp while the exam is still published and unlocked.
    expect: "published",
    require: "unlockable",
  });
  if (!written) {
    const latest = await requireState(tenant, input.examId);
    const latestRejection = unpublishExamRejection(latest);
    if (latestRejection) throw unpublishError(latestRejection, latest.id);
    if (await ownsCompletedSession(tenant, input.examId)) {
      throw completedSessionError(latest.id);
    }
    throw lifecycleError(
      `Exam ${latest.id} changed while unlocking — reload and retry`,
      "exam_state_changed",
      { examId: latest.id },
    );
  }
  return written;
}
