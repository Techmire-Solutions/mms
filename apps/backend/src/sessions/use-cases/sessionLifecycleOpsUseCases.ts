import {
  normalizeSessionStatus,
  postponedSessionDates,
  sessionCancelBodySchema,
  sessionPostponeBodySchema,
  type Session,
  type SessionActivityItem,
  type SessionCancelBody,
  type SessionCancelResult,
  type SessionPostponeBody,
  type User,
} from "@mms/shared";
import { sessionsRepository } from "../repository/sessionsRepositoryAdapter.js";
import { sessionsAcademicRepository } from "../repository/sessionsAcademicRepositoryAdapter.js";
import { ConflictError, HttpDomainError, NotFoundError, ValidationError } from "../../lib/httpErrors.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import { endLiveEnrollments, SYSTEM_ACTOR } from "../../enrollments/use-cases/enrollmentEndUseCases.js";
import { assertSessionDateRange, workspaceToday } from "./sessionLockGuard.js";
import { transitionSession } from "./sessionTransitionService.js";
import { withTenant } from "../../db/tenant-context.js";
import { runAfterCommit } from "../../db/commitScope.js";
import {
  countLiveEnrollmentsTx,
  shiftSessionDependentDatesTx,
} from "../../db/repositories/sessionTransitionRepository.js";

const actorOf = (user: User | undefined) =>
  user ? { userId: user.id, label: user.name || user.email } : SYSTEM_ACTOR;

export interface SessionOperationToken {
  /** `sessions.version` the caller read. */
  expectedVersion?: number;
  /** Legacy millisecond `updated_at` token. */
  expectedUpdatedAt?: string;
}

async function loadSession(tenant: string, id: string): Promise<Session> {
  const session = await sessionsRepository.findSessionById(tenant, id);
  if (!session || session.deletedAt) throw new NotFoundError("Session not found");
  return session;
}

/**
 * Effects of sessions becoming `cancelled` (also run by the transition service for the update and
 * bulk paths): live enrollments are cancelled with today as last day and their later untouched
 * invoices voided.
 */
export async function onSessionsCancelled(
  tenant: string,
  sessionIds: readonly string[],
  reason = "Session cancelled",
  user?: User,
): Promise<SessionCancelResult> {
  return endLiveEnrollments(
    tenant,
    { sessionIds },
    { status: "cancelled", lastDay: await workspaceToday(tenant), reason, actor: actorOf(user) },
  );
}

const dayNumber = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / 86_400_000;

/** Session-level lifecycle actions (Phase 9e). */
export const sessionLifecycleOpsUseCases = {
  /**
   * Cancels through the single transition path: reason required, OCC honoured, status CAS, live
   * enrollments ended and invoices voided in the same transaction, one audit row.
   */
  async cancel(
    tenant: string,
    id: string,
    body: SessionCancelBody,
    user: User,
    token: SessionOperationToken = {},
  ): Promise<SessionCancelResult> {
    const input = sessionCancelBodySchema.parse(body);
    const transition = await transitionSession(tenant, id, {
      to: "cancelled",
      reason: input.reason,
      actor: actorOf(user),
      expectedVersion: token.expectedVersion,
      expectedUpdatedAt: token.expectedUpdatedAt,
    });
    if (transition.noop) throw new ConflictError("The session is already cancelled");
    return {
      ended: transition.ended,
      billing: transition.billing ?? { cancelled: [], review: [] },
    };
  },

  /**
   * Only sessions that have not started (draft / open) move. Postponing a session with live
   * enrollments would desynchronise their placement windows, so it is refused; the operator moves
   * or withdraws enrollments first. Dependent dates (class deadlines, session calendar events) shift
   * by the same number of days inside the transaction.
   */
  async postpone(
    tenant: string,
    id: string,
    body: SessionPostponeBody,
    user: User,
    token: SessionOperationToken = {},
  ): Promise<Session> {
    const expected = token.expectedUpdatedAt?.trim();
    if (expected && Number.isNaN(Date.parse(expected)))
      throw new ValidationError("Invalid x-expected-updated-at header");
    if (token.expectedVersion === undefined && !expected)
      throw new HttpDomainError(
        428,
        "precondition_required",
        "Send x-expected-version (or x-expected-updated-at) with the value you read before saving",
      );
    return withTenant(tenant, async (tx) => {
      const input = sessionPostponeBodySchema.parse(body);
      const session = await loadSession(tenant, id);
      const state = normalizeSessionStatus(session.status);
      if (state !== "draft" && state !== "open")
        throw new ConflictError(
          "Only a session that has not started can be postponed; extend its end date instead",
        );
      const today = await workspaceToday(tenant);
      if (input.startDate < today)
        throw new ValidationError("The new start date cannot be in the past");
      const liveEnrollments = await countLiveEnrollmentsTx(tx, tenant, id);
      if (liveEnrollments > 0)
        throw new ConflictError(
          "This session already has enrollments; move or withdraw them before postponing it",
        );
      const dates = postponedSessionDates(session, input.startDate);
      assertSessionDateRange({
        startDate: dates.startDate,
        endDate: dates.endDate ?? session.endDate,
      });
      const previousStart = (session.startDate ?? "").slice(0, 10);
      const delta = previousStart ? dayNumber(dates.startDate) - dayNumber(previousStart) : 0;
      const updated = await sessionsRepository.updateSessionDates(
        tenant,
        id,
        { startDate: dates.startDate, endDate: dates.endDate ?? session.endDate },
        {
          ...(expected ? { expectedUpdatedAt: expected } : {}),
          ...(token.expectedVersion !== undefined
            ? { expectedVersion: token.expectedVersion }
            : {}),
        },
      );
      if (!updated) throw new NotFoundError("Session not found");
      if (delta !== 0) await shiftSessionDependentDatesTx(tx, tenant, id, delta);
      await recordModernAuditEvent(tx, {
        workspaceSubdomain: tenant,
        tableName: "sessions",
        recordId: id,
        actionType: "UPDATE",
        realUserId: user.id,
        newState: {
          operation: "postpone",
          from: { startDate: session.startDate, endDate: session.endDate },
          to: dates,
          shiftDays: delta,
          reason: input.reason,
        },
      });
      runAfterCommit(() => broadcastCollection("sessions"));
      return loadSession(tenant, id);
    });
  },

  async activity(tenant: string, id: string): Promise<SessionActivityItem[]> {
    await loadSession(tenant, id);
    return sessionsAcademicRepository.listSessionActivity(tenant, id);
  },
};
