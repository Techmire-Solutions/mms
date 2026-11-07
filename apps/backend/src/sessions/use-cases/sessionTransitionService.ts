import {
  InvalidSessionStatusError,
  evaluateSessionTransition,
  isTransitionFullyOverridable,
  normalizeSessionModulePreferences,
  normalizeSessionStatus,
  parseSessionStatus,
  type Session,
  type SessionTransitionViolation,
  type WithdrawalBillingOutcome,
} from "@mms/shared";
import { sessionsRepository } from "../repository/sessionsRepositoryAdapter.js";
import {
  countLiveEnrollmentsTx,
  countSessionAttendanceTx,
  countSessionExamResultsTx,
  getSessionModulePreferencesByWorkspace,
  lockSessionForTransitionTx,
  sessionHasBudgetTx,
  updateSessionStatusIfTx,
} from "../repository/sessionTransitionRepositoryAdapter.js";
import { withTenant } from "../../db/tenant-context.js";
import { runAfterCommit } from "../../db/commitScope.js";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/httpErrors.js";
import { invalidateMultiTierCache } from "../../lib/cache/index.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import {
  completeLiveEnrollments,
  endLiveEnrollments,
  SYSTEM_ACTOR,
} from "../../enrollments/use-cases/enrollmentEndUseCases.js";
import { workspaceToday } from "./sessionLockGuard.js";
import { SessionTransitionBlockedError } from "./sessionTransitionErrors.js";

/** Who performed the transition (attached to the audit row and the enrollment timeline). */
export interface TransitionActor {
  userId?: string | null;
  label?: string;
}

export interface TransitionOptions {
  /** Target lifecycle state (lifecycle values or legacy aliases; anything else is a 400). */
  to: string;
  /** Cancellation reason (≥3 chars) — required by every cancel path. */
  reason?: string | null;
  /** Monotonic OCC token (`sessions.version`) the caller read. */
  expectedVersion?: number;
  /** Legacy OCC token (millisecond `updated_at`) for clients that have not migrated yet. */
  expectedUpdatedAt?: string;
  actor?: TransitionActor;
  /** `sessions.override_lock` — waives the overridable guards when a reason is given. */
  canOverride?: boolean;
}

export interface TransitionResult {
  session: Session;
  /** Enrollments ended by this transition (cancel / completion). */
  ended: number;
  /** Billing outcome for a cancellation (null for other transitions). */
  billing: WithdrawalBillingOutcome | null;
  /** Guards that were waived by an authorized override (audited). */
  overridden: SessionTransitionViolation[];
  /** The session was already in the requested state; nothing was written. */
  noop: boolean;
}

/** Cancel closes enrollments on the session's last day, never after it and never in the future. */
function cancelLastDay(today: string, endDate: string | null): string {
  const end = (endDate ?? "").slice(0, 10);
  return end && end < today ? end : today;
}

function toOperationActor(actor: TransitionActor | undefined) {
  return actor?.userId
    ? { userId: actor.userId, label: actor.label || actor.userId }
    : SYSTEM_ACTOR;
}

/**
 * The single write path for every session status change (edit form, bulk status, cancel action,
 * auto-start, import, completion). It
 * - locks the row and enforces the requested `version`/`updated_at` (OCC),
 * - evaluates the lifecycle guards against freshly-read counts,
 * - writes with a compare-and-set on the current status,
 * - runs the enrollment/billing side effects **inside the same transaction**, and
 * - audits the transition; broadcasts/cache invalidation run only after the commit.
 */
export async function transitionSession(
  tenant: string,
  id: string,
  options: TransitionOptions,
): Promise<TransitionResult> {
  const subdomain = tenant.trim().toLowerCase();
  let target: string;
  try {
    target = parseSessionStatus(options.to);
  } catch (error) {
    if (error instanceof InvalidSessionStatusError)
      throw new ValidationError(`Unknown session status: ${String(options.to)}`);
    throw error;
  }
  const expected = options.expectedUpdatedAt?.trim();
  if (expected && Number.isNaN(Date.parse(expected)))
    throw new ValidationError("Invalid x-expected-updated-at header");
  if (options.expectedVersion !== undefined && !Number.isInteger(options.expectedVersion))
    throw new ValidationError("Invalid x-expected-version header");

  const result = await withTenant(subdomain, async (tx) => {
    const row = await lockSessionForTransitionTx(tx, subdomain, id);
    if (!row) throw new NotFoundError("Session not found");
    if (options.expectedVersion !== undefined) {
      if (Number(row.version) !== Number(options.expectedVersion))
        throw new ConflictError("This session was modified by another user — reload and try again");
    } else if (expected && row.updatedAt.toISOString() !== new Date(expected).toISOString()) {
      throw new ConflictError("This session was modified by another user — reload and try again");
    }

    const today = await workspaceToday(subdomain);
    const from = normalizeSessionStatus(row.status);
    if (from === normalizeSessionStatus(target)) {
      const session = await sessionsRepository.findSessionById(subdomain, id);
      if (!session) throw new NotFoundError("Session not found");
      return { session, ended: 0, billing: null, overridden: [], noop: true } as TransitionResult;
    }

    const preferences = normalizeSessionModulePreferences(
      await getSessionModulePreferencesByWorkspace(subdomain),
    );
    const evaluation = evaluateSessionTransition(from, target, {
      today,
      endDate: row.endDate,
      reason: options.reason,
      requireBudget: preferences.requireBudget,
      liveEnrollments: await countLiveEnrollmentsTx(tx, subdomain, id),
      attendanceRows: await countSessionAttendanceTx(tx, subdomain, id),
      examResults: await countSessionExamResultsTx(tx, subdomain, id),
      hasBudget: await sessionHasBudgetTx(tx, subdomain, id),
    });
    let overridden: SessionTransitionViolation[] = [];
    if (!evaluation.allowed) {
      const overrideReason = (options.reason ?? "").trim();
      const mayOverride =
        options.canOverride === true &&
        overrideReason.length >= 3 &&
        isTransitionFullyOverridable(evaluation);
      if (!mayOverride) throw new SessionTransitionBlockedError(evaluation.violations);
      overridden = evaluation.violations;
    }

    const wrote = await updateSessionStatusIfTx(tx, subdomain, id, row.status, target);
    if (!wrote)
      throw new ConflictError(
        "This session changed while the action was running — reload and try again",
      );

    const actor = toOperationActor(options.actor);
    let ended = 0;
    let billing: WithdrawalBillingOutcome | null = null;
    if (target === "cancelled") {
      const outcome = await endLiveEnrollments(
        subdomain,
        { sessionIds: [id] },
        {
          status: "cancelled",
          lastDay: cancelLastDay(today, row.endDate),
          reason: (options.reason ?? "").trim() || "Session cancelled",
          actor,
        },
      );
      ended = outcome.ended;
      billing = outcome.billing;
    } else if (target === "completed") {
      const completion = await completeLiveEnrollments(
        subdomain,
        id,
        (row.endDate ?? today).slice(0, 10),
        actor,
      );
      ended = completion.ended;
    }

    await recordModernAuditEvent(tx, {
      workspaceSubdomain: subdomain,
      tableName: "sessions",
      recordId: id,
      actionType: "UPDATE",
      realUserId: options.actor?.userId ?? undefined,
      oldState: {
        status: from,
        startDate: row.startDate,
        endDate: row.endDate,
        version: Number(row.version),
      },
      newState: {
        operation: "transition",
        from,
        to: target,
        reason: options.reason ?? null,
        overridden,
        enrollmentsEnded: ended,
        cancelledInvoiceIds: billing?.cancelled.map((invoice) => invoice.id) ?? [],
        invoicesForReview: billing?.review.map((invoice) => invoice.id) ?? [],
      },
    });

    const session = await sessionsRepository.findSessionById(subdomain, id);
    if (!session) throw new NotFoundError("Session not found");
    if (ended > 0) runAfterCommit(() => broadcastCollection("enrollments"));
    runAfterCommit(() => broadcastCollection("sessions"));
    return { session, ended, billing, overridden, noop: false } as TransitionResult;
  });

  await invalidateMultiTierCache({ tenantId: subdomain, domain: "sessions" });
  return result;
}
