import { ENROLLMENT_STATUSES, type EnrollmentStatus } from "./enrollmentsModuleManifest.js";
import {
  REGISTRATION_APPLICATION_STATUSES,
  type RegistrationApplicationStatus,
} from "./registrationTypes.js";

/**
 * The enrollment state machine.
 *
 * Modelled on `sessions/sessionTransitions.ts`: one table, one predicate, used by the
 * use cases (never by route handlers) so an illegal transition cannot be reached through
 * any write path — generic CRUD, bulk operations, session transitions or rollover.
 *
 * There are two channels because the same edge can be legitimate for the service and
 * illegitimate for a client:
 *
 *  - `manual`    — the generic enrollment create/update endpoint. Only `pending → confirmed`
 *                  (fee confirmation) has no side effects worth owning; every other edge
 *                  must go through the operation that carries its side effects
 *                  (placement close, invoice settlement, waitlist offer, audit).
 *  - `operation` — the named use cases (withdraw/cancel/readmit/session completion/
 *                  rollover). They still may not regress a terminal row.
 *
 * Seat accounting is a different question: `enrollmentHoldsSeat` deliberately counts
 * `completed` (revenue reporting). "Operable" is the narrower set below and is what
 * batch paths must use.
 */

/** Statuses with no outgoing transition: the row is history. */
export const ENROLLMENT_TERMINAL_STATUSES = [
  "cancelled",
  "completed",
  "promoted",
  "retained",
  "graduated",
  "left",
] as const satisfies readonly EnrollmentStatus[];

/** Statuses a staff operation (transfer, withdraw, suspend, readmission source) may act on. */
export const ENROLLMENT_OPERABLE_STATUSES = [
  "pending",
  "confirmed",
] as const satisfies readonly EnrollmentStatus[];

export type EnrollmentTransitionChannel = "manual" | "operation";

const MANUAL_TRANSITIONS: Partial<Record<EnrollmentStatus, readonly EnrollmentStatus[]>> = {
  pending: ["confirmed"],
};

const OPERATION_TRANSITIONS: Record<EnrollmentStatus, readonly EnrollmentStatus[]> = {
  pending: ["confirmed", "withdrawn", "cancelled"],
  confirmed: ["completed", "withdrawn", "cancelled"],
  // Re-admission is the only edge out of `withdrawn`; it is owned by `lifecycle.readmit`
  // (placement reopened, fee recomputed), never by a plain status write.
  withdrawn: ["confirmed"],
  cancelled: [],
  completed: [],
  promoted: [],
  retained: [],
  graduated: [],
  left: [],
};

export class InvalidEnrollmentStatusError extends Error {
  readonly code = "invalid_enrollment_status";
  constructor(readonly raw: unknown) {
    super(`Unknown enrollment status: ${String(raw ?? "")}`);
    this.name = "InvalidEnrollmentStatusError";
  }
}

/** Strict write-path parsing — unknown strings are rejected, not coerced. */
export function parseEnrollmentStatus(raw: unknown): EnrollmentStatus {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if ((ENROLLMENT_STATUSES as readonly string[]).includes(value)) return value as EnrollmentStatus;
  throw new InvalidEnrollmentStatusError(raw);
}

export function isEnrollmentStatus(raw: unknown): raw is EnrollmentStatus {
  if (typeof raw !== "string") return false;
  return (ENROLLMENT_STATUSES as readonly string[]).includes(raw.trim().toLowerCase());
}

export function isEnrollmentTerminal(status: string): boolean {
  return (ENROLLMENT_TERMINAL_STATUSES as readonly string[]).includes(status);
}

export function enrollmentAllowsOperations(status: string): boolean {
  return (ENROLLMENT_OPERABLE_STATUSES as readonly string[]).includes(status);
}

/** Whether `from → to` is legal for the given channel (same status is always a no-op). */
export function canTransitionEnrollment(
  from: string,
  to: string,
  options: { channel?: EnrollmentTransitionChannel } = {},
): boolean {
  if (!isEnrollmentStatus(from) || !isEnrollmentStatus(to)) return false;
  if (from === to) return true;
  const table =
    (options.channel ?? "operation") === "manual" ? MANUAL_TRANSITIONS : OPERATION_TRANSITIONS;
  return (table[from] ?? []).includes(to);
}

/** Statuses the UI may offer from `from` on the given channel. */
export function allowedEnrollmentTransitions(
  from: string,
  options: { channel?: EnrollmentTransitionChannel } = {},
): EnrollmentStatus[] {
  if (!isEnrollmentStatus(from)) return [];
  const table =
    (options.channel ?? "operation") === "manual" ? MANUAL_TRANSITIONS : OPERATION_TRANSITIONS;
  return [...(table[from] ?? [])];
}

/**
 * Whether an enrollment is currently suspended: an approved leave range covers `today`.
 *
 * Suspension is intentionally not a persisted status — the enrollment keeps its seat and
 * billing while attendance marks it on leave. The UI renders this derived badge.
 */
export function isEnrollmentSuspended(
  leaves: ReadonlyArray<{ fromOn: string; toOn: string; status?: string | null }>,
  today: string,
): boolean {
  return leaves.some(
    (leave) =>
      (leave.status ?? "approved") === "approved" && leave.fromOn <= today && leave.toOn >= today,
  );
}

// ─── Registration application state machine ───────────────────────────────────

/**
 * Admissions review workflow. `approved` is immutable (the enrollment owns the next
 * steps); `withdrawn` is terminal. Re-opening a rejected application goes through
 * `under_review` so the decision is visible in the audit trail.
 */
export const APPLICATION_TRANSITIONS: Record<
  RegistrationApplicationStatus,
  readonly RegistrationApplicationStatus[]
> = {
  submitted: ["under_review", "waitlisted", "rejected", "approved"],
  under_review: ["waitlisted", "rejected", "approved"],
  waitlisted: ["under_review", "rejected", "approved"],
  rejected: ["under_review"],
  approved: [],
  withdrawn: [],
};

export class InvalidApplicationStatusError extends Error {
  readonly code = "invalid_application_status";
  constructor(readonly raw: unknown) {
    super(`Unknown registration application status: ${String(raw ?? "")}`);
    this.name = "InvalidApplicationStatusError";
  }
}

export function parseApplicationStatus(raw: unknown): RegistrationApplicationStatus {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if ((REGISTRATION_APPLICATION_STATUSES as readonly string[]).includes(value))
    return value as RegistrationApplicationStatus;
  throw new InvalidApplicationStatusError(raw);
}

export function canTransitionApplication(from: string, to: string): boolean {
  if (
    !(REGISTRATION_APPLICATION_STATUSES as readonly string[]).includes(from) ||
    !(REGISTRATION_APPLICATION_STATUSES as readonly string[]).includes(to)
  ) {
    return false;
  }
  if (from === to) return true;
  return (APPLICATION_TRANSITIONS[from as RegistrationApplicationStatus] ?? []).includes(
    to as RegistrationApplicationStatus,
  );
}

export function allowedApplicationTransitions(from: string): RegistrationApplicationStatus[] {
  if (!(REGISTRATION_APPLICATION_STATUSES as readonly string[]).includes(from)) return [];
  return [...(APPLICATION_TRANSITIONS[from as RegistrationApplicationStatus] ?? [])];
}
