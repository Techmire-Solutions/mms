import {
  enrollmentHoldsSeat,
  isSessionReadOnly,
  type Enrollment,
  type Session,
  type User,
} from "@mms/shared";
import { enrollmentOperationsRepository as repo } from "../repository/enrollmentOperationsRepositoryAdapter.js";
import { ConflictError, NotFoundError } from "../../lib/httpErrors.js";
import { todayInTimeZone } from "../../lib/dbDate.js";
import { invalidateMultiTierCache } from "../../lib/cache/index.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import type { TenantTransaction } from "../../db/tenant-context.js";

/** Enrollment + its session when the session still accepts changes; 404/409 otherwise. */
export async function loadEnrollmentInOpenSession(
  tenant: string,
  id: string,
): Promise<{ enrollment: Enrollment; session: Session; today: string }> {
  const enrollment = await repo.findEnrollmentById(tenant, id);
  if (!enrollment || enrollment.deletedAt) throw new NotFoundError("Enrollment not found");
  const session = await repo.findSessionById(tenant, enrollment.sessionId);
  if (!session) throw new NotFoundError("Session not found");
  if (isSessionReadOnly(session.status))
    throw new ConflictError("The session is closed; its enrollments are read-only");
  const today = todayInTimeZone(await repo.findWorkspaceTimezone(tenant));
  return { enrollment, session, today };
}

/** A live (seat-holding, not completed) enrollment in an open session, with its placements. */
export async function loadOperable(tenant: string, id: string) {
  const loaded = await loadEnrollmentInOpenSession(tenant, id);
  const { enrollment } = loaded;
  if (!enrollmentHoldsSeat(enrollment.status) || enrollment.status === "completed")
    throw new ConflictError(`A ${enrollment.status} enrollment cannot be changed`);
  const placements = await repo.listEnrollmentPlacements(tenant, enrollment.id);
  return { ...loaded, placements };
}

/**
 * Appends the operation's audit row **inside the mutation transaction**.
 *
 * The old helper wrote it in a separate transaction after the change had committed, so an
 * audit failure left a committed operation with no trail entry.
 */
export async function recordOperationAudit(
  tx: TenantTransaction,
  tenant: string,
  user: User,
  before: Enrollment,
  action: string,
  detail: Record<string, unknown>,
  options?: { oldState?: Record<string, unknown>; reasonCode?: string },
): Promise<void> {
  await recordModernAuditEvent(tx, {
    workspaceSubdomain: tenant,
    tableName: "enrollments",
    recordId: before.id,
    actionType: "UPDATE",
    realUserId: user.id,
    oldState: options?.oldState,
    newState: {
      operation: action,
      ...(options?.reasonCode ? { reasonCode: options.reasonCode } : {}),
      ...detail,
    },
  });
}

/** Cache + live-push after the transaction commits; returns the refreshed enrollment. */
export async function afterChange(tenant: string, before: Enrollment): Promise<Enrollment> {
  await invalidateMultiTierCache({ tenantId: tenant, domain: "students" });
  await invalidateMultiTierCache({ tenantId: tenant, domain: "sessions" });
  await broadcastCollection("enrollments");
  await broadcastCollection("sessions");
  // The mutation has already committed: a failed refetch must not surface as an error (the
  // client would retry an operation that succeeded). Fall back to the pre-change snapshot.
  const after = await repo.findEnrollmentById(tenant, before.id).catch(() => null);
  if (!after) return before;
  return after;
}

export const actorOf = (user: User) => ({ userId: user.id, label: user.name || user.email });
