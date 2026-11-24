/**
 * Workshop lifecycle machine (migration 0245 CHECK).
 *
 * The product talks about seven states — Draft, Registration Open, Registration Closed, Ongoing,
 * Completed, Cancelled, Archived. Only four are persisted (`draft`, `open`, `completed`,
 * `cancelled`); "archived" is the soft-delete marker and the three date-driven phases are derived by
 * {@link deriveWorkshopPhase}. This mirrors the sessions model (`sessionTransitions.ts`): a persisted
 * intent plus a derived phase, so no background sweep is needed to keep a workshop's state honest.
 *
 * ```
 * draft → open → completed
 *   ↘ cancelled ↗        (terminal states are archived through the trash, not another status)
 * ```
 */

export const WORKSHOP_LIFECYCLE_STATES = ["draft", "open", "completed", "cancelled"] as const;
export type WorkshopLifecycleState = (typeof WORKSHOP_LIFECYCLE_STATES)[number];
/** Canonical public name for a workshop's persisted lifecycle state. */
export type WorkshopStatus = WorkshopLifecycleState;

/** The seven product states plus `finished` (event over, completion not yet recorded). */
export const WORKSHOP_PHASES = [
  "draft",
  "registration_open",
  "registration_closed",
  "ongoing",
  "finished",
  "completed",
  "cancelled",
  "archived",
] as const;
export type WorkshopPhase = (typeof WORKSHOP_PHASES)[number];

/**
 * Allowed persisted transitions. A same-state write is a legal no-op
 * ({@link canTransitionWorkshop}). Completed and cancelled are terminal: the only way out is the
 * trash (`deleted_at`), and a restore keeps the status it had.
 */
export const WORKSHOP_TRANSITIONS: Readonly<
  Record<WorkshopLifecycleState, readonly WorkshopLifecycleState[]>
> = {
  draft: ["open", "cancelled"],
  open: ["draft", "completed", "cancelled"],
  completed: [],
  cancelled: [],
};

/** Statuses a new workshop may be created with; the form publishes straight to `open`. */
export const WORKSHOP_CREATE_STATUSES = ["draft", "open"] as const;
export type WorkshopCreateStatus = (typeof WORKSHOP_CREATE_STATUSES)[number];

/** Statuses in which participants may be registered (the date gates still apply). */
export const WORKSHOP_REGISTRABLE_STATUSES: readonly WorkshopLifecycleState[] = ["open"];

/**
 * Lenient read-path mapping. Unknown or hand-edited values fall back to `draft` so a row can still
 * be rendered; **never** use this on a write path (use {@link parseWorkshopStatus}).
 */
export function normalizeWorkshopStatus(raw: string | null | undefined): WorkshopLifecycleState {
  const value = (raw ?? "").trim().toLowerCase();
  if ((WORKSHOP_LIFECYCLE_STATES as readonly string[]).includes(value)) {
    return value as WorkshopLifecycleState;
  }
  return "draft";
}

/** A write-path status value that is not a lifecycle state. */
export class InvalidWorkshopStatusError extends Error {
  readonly code = "invalid_workshop_status";
  constructor(readonly raw: unknown) {
    super(`Unknown workshop status: ${String(raw ?? "")}`);
    this.name = "InvalidWorkshopStatusError";
  }
}

/** Strict write-path parsing: anything that is not a lifecycle state is rejected. */
export function parseWorkshopStatus(raw: unknown): WorkshopLifecycleState {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if ((WORKSHOP_LIFECYCLE_STATES as readonly string[]).includes(value)) {
    return value as WorkshopLifecycleState;
  }
  throw new InvalidWorkshopStatusError(raw);
}

/** Whether `from → to` is a legal transition (same state is a no-op). */
export function canTransitionWorkshop(from: string, to: string): boolean {
  const source = normalizeWorkshopStatus(from);
  const target = normalizeWorkshopStatus(to);
  return source === target || WORKSHOP_TRANSITIONS[source].includes(target);
}

export function isWorkshopReadOnly(status: string): boolean {
  const state = normalizeWorkshopStatus(status);
  return state === "completed" || state === "cancelled";
}

/** The workshop accepts registrations only from `open` (date gates are separate). */
export function isWorkshopRegistrable(status: string): boolean {
  return WORKSHOP_REGISTRABLE_STATUSES.includes(normalizeWorkshopStatus(status));
}

/**
 * Whether a queued registration may take a freed seat: the workshop is still open and its last day
 * has not passed. The registration deadline is deliberately not re-checked — a queued participant
 * joined before it closed.
 */
export function isWorkshopWaitlistPromotable(
  workshop: { status: string; startDate?: string | null; endDate?: string | null },
  today: string,
): boolean {
  if (normalizeWorkshopStatus(workshop.status) !== "open") return false;
  const lastDay = workshopLastDay(workshop);
  return !lastDay || (today ?? "").slice(0, 10) <= lastDay;
}

/** `end_date` when set, otherwise the one-day workshop's start. */
export function workshopLastDay(input: {
  startDate?: string | null;
  endDate?: string | null;
}): string | null {
  const end = (input.endDate ?? "").slice(0, 10);
  if (end) return end;
  const start = (input.startDate ?? "").slice(0, 10);
  return start || null;
}

export interface WorkshopPhaseInput {
  status: string;
  startDate?: string | null;
  endDate?: string | null;
  registrationDeadline?: string | null;
  deletedAt?: string | null;
}

/**
 * Maps a workshop onto the product's state vocabulary:
 * Draft → `draft`; Open before the deadline → `registration_open`; deadline passed →
 * `registration_closed`; inside its dates → `ongoing`; past the last day but not yet closed →
 * `finished`; explicitly closed → `completed`; cancelled → `cancelled`; trashed → `archived`.
 *
 * `today` is the workspace business day (`YYYY-MM-DD`), never the browser's.
 */
export function deriveWorkshopPhase(
  workshop: WorkshopPhaseInput,
  options: { today: string },
): WorkshopPhase {
  if (workshop.deletedAt) return "archived";
  const state = normalizeWorkshopStatus(workshop.status);
  if (state === "completed") return "completed";
  if (state === "cancelled") return "cancelled";
  if (state === "draft") return "draft";

  const today = (options.today ?? "").slice(0, 10);
  const start = (workshop.startDate ?? "").slice(0, 10);
  const lastDay = workshopLastDay(workshop);
  const deadline = (workshop.registrationDeadline ?? "").slice(0, 10);

  if (lastDay && today > lastDay) return "finished";
  if (deadline && today > deadline) return "registration_closed";
  if (start && today >= start) return "ongoing";
  return "registration_open";
}

// ─── Transition guards ───────────────────────────────────────────────────────────────────────

export const WORKSHOP_TRANSITION_VIOLATIONS = [
  "illegal_transition",
  "workshop_has_registrations",
  "end_date_required",
  "completion_before_end_date",
  "certificates_issued",
] as const;
export type WorkshopTransitionViolation = (typeof WORKSHOP_TRANSITION_VIOLATIONS)[number];

export interface WorkshopTransitionContext {
  /** Workspace business day (`YYYY-MM-DD`). */
  today: string;
  /** Active registrations (required for `open → draft`). */
  liveRegistrations?: number;
  /** Issued participation certificates (required for `→ cancelled`). */
  certificatesIssued?: number;
  startDate?: string | null;
  endDate?: string | null;
}

export interface WorkshopTransitionEvaluation {
  allowed: boolean;
  /** Same-state write: legal and side-effect free. */
  noop: boolean;
  violations: WorkshopTransitionViolation[];
}

/**
 * Pure guard table for a workshop status change. Callers pass the counts they read **inside the
 * same transaction** and the workspace business day, so the rule is unit-testable without a
 * database and cannot be evaluated against stale state.
 */
export function evaluateWorkshopTransition(
  from: string,
  to: string,
  context: WorkshopTransitionContext,
): WorkshopTransitionEvaluation {
  const source = normalizeWorkshopStatus(from);
  const target = normalizeWorkshopStatus(to);
  if (source === target) return { allowed: true, noop: true, violations: [] };

  const violations: WorkshopTransitionViolation[] = [];
  if (!WORKSHOP_TRANSITIONS[source].includes(target)) violations.push("illegal_transition");

  // Un-publishing a workshop that already sold seats silently invalidates the registrations.
  if (source === "open" && target === "draft" && (context.liveRegistrations ?? 0) > 0) {
    violations.push("workshop_has_registrations");
  }

  // Completion closes the books: it can only happen after the last workshop day.
  if (target === "completed") {
    const lastDay = workshopLastDay(context);
    if (!lastDay) violations.push("end_date_required");
    else if (lastDay >= (context.today ?? "").slice(0, 10)) {
      violations.push("completion_before_end_date");
    }
  }

  // Cancelling after certificates were issued cannot be undone for the holders.
  if (target === "cancelled" && (context.certificatesIssued ?? 0) > 0) {
    violations.push("certificates_issued");
  }

  return { allowed: violations.length === 0, noop: false, violations };
}
