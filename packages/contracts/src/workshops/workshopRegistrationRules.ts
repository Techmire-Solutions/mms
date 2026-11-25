import { isWorkshopRegistrable, workshopLastDay } from "./workshopLifecycle.js";

/**
 * Registration eligibility, extracted from `workshopLifecycle.ts` for the 300-line band.
 *
 * `evaluateWorkshopRegistration` answers "may this contact register at all right now"; the
 * lifecycle module owns the state machine, this module owns the intake gates
 * (open/deadline/ended/capacity) and the waitlist absorption rule.
 */

export const WORKSHOP_REGISTRATION_BLOCKERS = [
  "workshop_not_open",
  "deadline_passed",
  "workshop_ended",
  "capacity_full",
] as const;
export type WorkshopRegistrationBlocker = (typeof WORKSHOP_REGISTRATION_BLOCKERS)[number];

export interface WorkshopRegistrationEvaluation {
  allowed: boolean;
  blockers: WorkshopRegistrationBlocker[];
}

export interface WorkshopRegistrationInput {
  status: string;
  startDate?: string | null;
  endDate?: string | null;
  registrationDeadline?: string | null;
  capacity?: number | null;
  /** When the workshop is full, a waitlist-enabled workshop accepts a queued row instead. */
  waitlistEnabled?: boolean;
}

export interface WorkshopRegistrationContext {
  /** Workspace business day (`YYYY-MM-DD`). */
  today: string;
  /** Active (non-archived) registrations on the workshop. */
  seatsTaken: number;
}

/**
 * Pure registration eligibility. Ordered from the widest gate to the narrowest so the API can
 * report the most meaningful blocker: a closed workshop never reports "full".
 */
export function evaluateWorkshopRegistration(
  workshop: WorkshopRegistrationInput,
  context: WorkshopRegistrationContext,
): WorkshopRegistrationEvaluation {
  if (!isWorkshopRegistrable(workshop.status)) {
    return { allowed: false, blockers: ["workshop_not_open"] };
  }
  const today = (context.today ?? "").slice(0, 10);
  const blockers: WorkshopRegistrationBlocker[] = [];
  const deadline = (workshop.registrationDeadline ?? "").slice(0, 10);
  if (deadline && today > deadline) blockers.push("deadline_passed");
  const lastDay = workshopLastDay(workshop);
  if (lastDay && today > lastDay) blockers.push("workshop_ended");
  if (workshop.capacity !== null && workshop.capacity !== undefined) {
    if (context.seatsTaken >= workshop.capacity) blockers.push("capacity_full");
  }
  return { allowed: blockers.length === 0, blockers };
}

/** What a registration attempt does: take a seat, join the waitlist, or fail. */
export type WorkshopRegistrationOutcome = "seated" | "waitlisted" | "blocked";

export interface WorkshopRegistrationResolution {
  outcome: WorkshopRegistrationOutcome;
  blockers: WorkshopRegistrationBlocker[];
}

/**
 * Resolves the capacity question on top of {@link evaluateWorkshopRegistration}: `capacity_full`
 * is the only blocker a waitlist can absorb, and only when the workshop opted in. Every other
 * blocker (not open, deadline passed, workshop over) stays a hard refusal — queueing for a
 * workshop that cannot happen is worse than a clear 409.
 */
export function resolveWorkshopRegistration(
  workshop: WorkshopRegistrationInput,
  context: WorkshopRegistrationContext,
): WorkshopRegistrationResolution {
  const evaluation = evaluateWorkshopRegistration(workshop, context);
  if (evaluation.allowed) return { outcome: "seated", blockers: [] };
  const onlyCapacityFull =
    evaluation.blockers.length === 1 && evaluation.blockers[0] === "capacity_full";
  if (onlyCapacityFull && workshop.waitlistEnabled) {
    return { outcome: "waitlisted", blockers: [] };
  }
  return { outcome: "blocked", blockers: evaluation.blockers };
}
