import {
  evaluateWorkshopDateRules,
  resolveWorkshopRegistration,
  evaluateWorkshopTransition,
  isWorkshopReadOnly,
  normalizeWorkshopStatus,
  workshopLastDay,
  type WorkshopDateInput,
  type WorkshopTransitionContext,
} from "@mms/shared";
import { ConflictError, HttpDomainError, NotFoundError } from "../../lib/httpErrors.js";

/**
 * Pure write guards for the workshop aggregate.
 *
 * These are domain rules, not persistence concerns, but they must run inside the same transaction
 * as the write they guard — so they live here as pure functions that the adapter calls after
 * reading the current row (the same seam as `examinations/domain/examWriteGuards.ts`). Route
 * handlers own transport and authorization only; the adapters own no policy of their own.
 *
 * Lifecycle background: `workshop_events` had no status at all, so a cancelled/finished workshop
 * kept accepting registrations, attendance and certificates. See
 * docs/workshops-domain-lifecycle-audit-2026-11-12.md.
 */

interface WorkshopState {
  id: string;
  status: string;
  startDate?: string | null;
  endDate?: string | null;
  registrationDeadline?: string | null;
  capacity?: number | null;
  deletedAt?: Date | null;
}

function stateLabel(id: string, status: string): string {
  return `Workshop ${id} is ${normalizeWorkshopStatus(status)}`;
}

export function workshopArchivedError(id: string): NotFoundError {
  return new NotFoundError(`Workshop ${id} is archived — restore it before editing`);
}

/** Archived (soft-deleted) workshops are read-only through every write path. */
export function assertWorkshopNotArchived(state: { id: string; deletedAt?: Date | null }): void {
  if (state.deletedAt) throw workshopArchivedError(state.id);
}

/** Structural edits (dates, capacity, fee, criteria) close with the workshop. */
export function assertWorkshopMutable(state: WorkshopState): void {
  assertWorkshopNotArchived(state);
  if (isWorkshopReadOnly(state.status)) {
    throw new ConflictError(
      `${stateLabel(state.id, state.status)} — its schedule and capacity are closed; archive it or create a new workshop`,
      "workshop_read_only",
      { id: state.id, status: normalizeWorkshopStatus(state.status) },
    );
  }
}

/** Mirrors the Zod rule inside the write transaction (the CHECK is the last resort). */
export function assertWorkshopDates(value: WorkshopDateInput): void {
  const violations = evaluateWorkshopDateRules(value);
  if (violations.length === 0) return;
  throw new HttpDomainError(
    400,
    "invalid_workshop_dates",
    violations.includes("end_before_start")
      ? "The workshop cannot end before it starts"
      : violations.includes("span_too_long")
        ? "A workshop cannot run longer than 62 days — model it as a session instead"
        : "The registration deadline cannot fall after the last workshop day",
    { details: { violations } },
  );
}

const REGISTRATION_MESSAGES = {
  workshop_not_open: "This workshop is not open for registration",
  deadline_passed: "Registration for this workshop has closed",
  workshop_ended: "This workshop has already taken place",
  capacity_full: "This workshop is full",
} as const;

export function blockedRegistrationError(
  workshopId: string,
  blockers: readonly (keyof typeof REGISTRATION_MESSAGES)[],
): ConflictError {
  const blocker = blockers[0] ?? "workshop_not_open";
  return new ConflictError(REGISTRATION_MESSAGES[blocker], blocker, {
    id: workshopId,
    blockers: [...blockers],
  });
}

/**
 * Registration gate. Runs after the event row is locked and the live seat count is read, so the
 * decision cannot race a cancel/complete/capacity change. A full waitlist-enabled workshop is not
 * blocked — the caller inserts a queued row instead (`resolveWorkshopRegistration`).
 */
export function assertWorkshopRegistrable(
  workshop: WorkshopState,
  context: { today: string; seatsTaken: number },
): void {
  assertWorkshopNotArchived(workshop);
  const resolution = resolveWorkshopRegistration(workshop, context);
  if (resolution.outcome !== "blocked") return;
  throw blockedRegistrationError(workshop.id, resolution.blockers);
}

/** A capacity edit cannot drop below the seats already sold (the seat count is read under the lock). */
export function assertCapacityAboveActive(
  capacity: number | null | undefined,
  activeRegistrations: number,
): void {
  if (capacity === undefined || capacity === null) return;
  if (capacity < activeRegistrations) {
    throw new ConflictError(
      `Capacity cannot be lower than the ${activeRegistrations} active registration(s) already on this workshop`,
      "capacity_below_active",
      { capacity, activeRegistrations },
    );
  }
}

/** Check-ins and scores are meaningless before the workshop opens and after it is cancelled. */
export function assertWorkshopActivityEditable(state: WorkshopState): void {
  assertWorkshopNotArchived(state);
  const status = normalizeWorkshopStatus(state.status);
  if (status === "draft") {
    throw new ConflictError(
      `Workshop ${state.id} is still a draft — publish it before marking attendance`,
      "workshop_draft",
      { id: state.id },
    );
  }
  if (status === "cancelled") {
    throw new ConflictError(
      `Workshop ${state.id} is cancelled — its participation records are closed`,
      "workshop_cancelled",
      { id: state.id },
    );
  }
}

/** A certificate cannot be revoked by withdrawing the participant who earned it. */
export function assertParticipantWithdrawable(
  workshop: WorkshopState,
  participant: { id: string; certificateIssuedAt: Date | null },
): void {
  assertWorkshopNotArchived(workshop);
  if (normalizeWorkshopStatus(workshop.status) === "cancelled") {
    throw new ConflictError(
      `Workshop ${workshop.id} is cancelled — its registrations are already archived`,
      "workshop_cancelled",
      { id: workshop.id },
    );
  }
  if (participant.certificateIssuedAt) {
    throw new ConflictError(
      "This participant already holds a certificate and cannot be withdrawn",
      "certificate_issued",
      { participantId: participant.id },
    );
  }
}

/**
 * Certificates are evidence that the workshop happened. They may only be issued once the last day
 * has passed (or the workshop was explicitly completed), and never for a cancelled workshop.
 */
export function assertCertificatesIssuable(
  workshop: WorkshopState,
  context: { today: string },
): void {
  assertWorkshopNotArchived(workshop);
  const status = normalizeWorkshopStatus(workshop.status);
  if (status === "cancelled") {
    throw new ConflictError(
      `Workshop ${workshop.id} is cancelled — no certificates can be issued`,
      "workshop_cancelled",
      { id: workshop.id },
    );
  }
  if (status === "completed") return;
  const lastDay = workshopLastDay(workshop);
  const today = (context.today ?? "").slice(0, 10);
  if (!lastDay || today <= lastDay) {
    throw new ConflictError(
      `Workshop ${workshop.id} has not finished yet — certificates can be issued after its last day`,
      "workshop_not_finished",
      { id: workshop.id, lastDay, today },
    );
  }
}

/** Rejects an illegal status move and reports every violation in one typed error. */
export function assertWorkshopTransitionAllowed(
  workshop: WorkshopState,
  target: string,
  context: Omit<WorkshopTransitionContext, "startDate" | "endDate">,
): void {
  assertWorkshopNotArchived(workshop);
  const evaluation = evaluateWorkshopTransition(workshop.status, target, {
    ...context,
    startDate: workshop.startDate,
    endDate: workshop.endDate,
  });
  if (evaluation.allowed) return;
  const violation = evaluation.violations[0]!;
  throw new ConflictError(
    transitionMessage(workshop.id, workshop.status, target, violation),
    violation === "illegal_transition" ? "illegal_workshop_transition" : violation,
    {
      id: workshop.id,
      from: normalizeWorkshopStatus(workshop.status),
      to: normalizeWorkshopStatus(target),
      violations: evaluation.violations,
    },
  );
}

function transitionMessage(id: string, from: string, to: string, violation: string): string {
  switch (violation) {
    case "illegal_transition":
      return `Workshop ${id} cannot move from ${normalizeWorkshopStatus(from)} to ${normalizeWorkshopStatus(to)}`;
    case "workshop_has_registrations":
      return "This workshop already has registrations — withdraw them before moving it back to draft";
    case "end_date_required":
      return "Add an end date before completing the workshop";
    case "completion_before_end_date":
      return "This workshop has not finished yet — complete it after its last day";
    case "certificates_issued":
      return "Certificates have already been issued — archive the workshop instead of cancelling it";
    default:
      return `Workshop ${id} cannot move from ${normalizeWorkshopStatus(from)} to ${normalizeWorkshopStatus(to)}`;
  }
}
