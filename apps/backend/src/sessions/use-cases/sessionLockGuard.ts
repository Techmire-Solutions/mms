import {
  canTransitionSession,
  findSessionEditViolations,
  normalizeSessionStatus,
  type Session,
  type SessionEditViolation,
} from "@mms/shared";
import { HttpDomainError, ValidationError } from "../../lib/httpErrors.js";
import { todayInTimeZone } from "../../lib/dbDate.js";
import { sessionsAcademicRepository } from "../repository/sessionsAcademicRepositoryAdapter.js";

/** Caller context for a session update (override needs Sessions setup rights + a reason). */
export interface SessionLockContext {
  canOverrideLock: boolean;
  lockOverrideReason?: string;
  /** Workspace business date; enables the past-timetable lock. */
  today?: string;
}

/** Today in the workspace timezone (the authority for business dates). */
export async function workspaceToday(tenant: string): Promise<string> {
  return todayInTimeZone(await sessionsAcademicRepository.findWorkspaceTimezone(tenant));
}

export class SessionLockedError extends HttpDomainError {
  constructor(readonly violations: SessionEditViolation[]) {
    super(
      409,
      "session_locked",
      `This session has started; locked changes: ${violations.join(", ")}`,
    );
  }
}

/**
 * Applies the shared lifecycle rules to an update: status changes must be allowed transitions;
 * structural changes after start need an authorized override with a reason.
 * `extraViolations` carries store-backed checks the pure policy cannot see (end-date bounds against
 * recorded attendance/enrollments) so they run through the same override/audit path.
 * Returns the violations that were overridden (for the audit trail).
 */
export function assertSessionEditable(
  before: Session,
  after: Session,
  ctx: SessionLockContext,
  extraViolations: readonly SessionEditViolation[] = [],
): SessionEditViolation[] {
  if (after.status !== undefined && !canTransitionSession(before.status, after.status)) {
    throw new ValidationError(
      `Cannot move a session from ${normalizeSessionStatus(before.status)} to ${normalizeSessionStatus(after.status)}`,
    );
  }
  const violations = [
    ...new Set([...findSessionEditViolations(before, after, ctx.today), ...extraViolations]),
  ];
  if (violations.length === 0) return [];
  const reason = ctx.lockOverrideReason?.trim();
  if (!ctx.canOverrideLock || !reason || reason.length < 3)
    throw new SessionLockedError(violations);
  return violations;
}

/** Rejects an end date before the start date (both are optional calendar days). */
export function assertSessionDateRange(session: {
  startDate?: string | null;
  endDate?: string | null;
}): void {
  const start = (session.startDate ?? "").slice(0, 10);
  const end = (session.endDate ?? "").slice(0, 10);
  if (start && end && end < start)
    throw new ValidationError("End date must be on or after the start date");
}
