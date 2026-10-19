import {
  canTransitionSession,
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
import { ConflictError, NotFoundError, ValidationError } from "../../lib/httpErrors.js";
import { invalidateMultiTierCache } from "../../lib/cache/index.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import {
  endLiveEnrollments,
  SYSTEM_ACTOR,
} from "../../enrollments/use-cases/enrollmentEndUseCases.js";
import { workspaceToday } from "./sessionLockGuard.js";

const actorOf = (user: User | undefined) =>
  user ? { userId: user.id, label: user.name || user.email } : SYSTEM_ACTOR;

async function loadSession(tenant: string, id: string): Promise<Session> {
  const session = await sessionsRepository.findSessionById(tenant, id);
  if (!session || session.deletedAt) throw new NotFoundError("Session not found");
  return session;
}

/**
 * Effects of sessions becoming `cancelled` (also run when the status changes through the regular
 * update or bulk-status paths): live enrollments are cancelled with today as last day and their
 * later untouched invoices voided.
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

/** Session-level lifecycle actions (Phase 9e). */
export const sessionLifecycleOpsUseCases = {
  async cancel(
    tenant: string,
    id: string,
    body: SessionCancelBody,
    user: User,
  ): Promise<SessionCancelResult> {
    const input = sessionCancelBodySchema.parse(body);
    const session = await loadSession(tenant, id);
    if (normalizeSessionStatus(session.status) === "cancelled")
      throw new ConflictError("The session is already cancelled");
    if (!canTransitionSession(session.status, "cancelled"))
      throw new ConflictError(
        `A ${normalizeSessionStatus(session.status)} session cannot be cancelled`,
      );
    await sessionsRepository.bulkUpdateSessionsStatus(tenant, [id], "cancelled");
    const result = await onSessionsCancelled(tenant, [id], input.reason, user);
    await recordModernAuditEvent({
      workspaceSubdomain: tenant,
      tableName: "sessions",
      recordId: id,
      actionType: "UPDATE",
      realUserId: user.id,
      newState: {
        operation: "cancel",
        reason: input.reason,
        enrollmentsEnded: result.ended,
        cancelledInvoiceIds: result.billing.cancelled.map((invoice) => invoice.id),
        invoicesForReview: result.billing.review.map((invoice) => invoice.id),
      },
    });
    await invalidateMultiTierCache({ tenantId: tenant, domain: "sessions" });
    await broadcastCollection("sessions");
    return result;
  },

  /** Only sessions that have not started (draft / open) move; started ones extend the end date. */
  async postpone(
    tenant: string,
    id: string,
    body: SessionPostponeBody,
    user: User,
  ): Promise<Session> {
    const input = sessionPostponeBodySchema.parse(body);
    const session = await loadSession(tenant, id);
    const state = normalizeSessionStatus(session.status);
    if (state !== "draft" && state !== "open")
      throw new ConflictError(
        "Only a session that has not started can be postponed; extend its end date instead",
      );
    if (input.startDate < (await workspaceToday(tenant)))
      throw new ValidationError("The new start date cannot be in the past");
    const dates = postponedSessionDates(session, input.startDate);
    await sessionsRepository.saveSession(tenant, {
      ...session,
      startDate: dates.startDate,
      endDate: dates.endDate ?? session.endDate,
    });
    await recordModernAuditEvent({
      workspaceSubdomain: tenant,
      tableName: "sessions",
      recordId: id,
      actionType: "UPDATE",
      realUserId: user.id,
      newState: {
        operation: "postpone",
        from: { startDate: session.startDate, endDate: session.endDate },
        to: dates,
        reason: input.reason,
      },
    });
    await invalidateMultiTierCache({ tenantId: tenant, domain: "sessions" });
    await broadcastCollection("sessions");
    return loadSession(tenant, id);
  },

  async activity(tenant: string, id: string): Promise<SessionActivityItem[]> {
    await loadSession(tenant, id);
    return sessionsAcademicRepository.listSessionActivity(tenant, id);
  },
};
