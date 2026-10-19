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

/** Audit + cache/broadcast after an operation; returns the refreshed enrollment. */
export async function afterChange(
  tenant: string,
  user: User,
  before: Enrollment,
  action: string,
  detail: Record<string, unknown>,
): Promise<Enrollment> {
  await recordModernAuditEvent({
    workspaceSubdomain: tenant,
    tableName: "enrollments",
    recordId: before.id,
    actionType: "UPDATE",
    realUserId: user.id,
    newState: { operation: action, ...detail },
  });
  await invalidateMultiTierCache({ tenantId: tenant, domain: "students" });
  await invalidateMultiTierCache({ tenantId: tenant, domain: "sessions" });
  await broadcastCollection("enrollments");
  await broadcastCollection("sessions");
  const after = await repo.findEnrollmentById(tenant, before.id);
  if (!after) throw new NotFoundError("Enrollment not found");
  return after;
}

export const actorOf = (user: User) => ({ userId: user.id, label: user.name || user.email });
