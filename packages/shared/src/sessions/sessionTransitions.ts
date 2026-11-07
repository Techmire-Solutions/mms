import { z } from "zod";

/**
 * Session lifecycle machine (migration 0169 CHECK). The requested eight-state model
 * (Draft, Planning, Open for Enrollment, Active, Exams, Completed, Closed, Archived) is mapped onto
 * these six persisted states; `deriveSessionPhase` exposes the finer-grained phase for UI/gating
 * without a schema change (`docs/sessions-schema-review-2026-11-06.md`).
 *
 * draft → open → in_progress → completed; cancelled / archived are terminal.
 */
export const SESSION_LIFECYCLE_STATES = [
  "draft",
  "open",
  "in_progress",
  "completed",
  "cancelled",
  "archived",
] as const;
export type SessionLifecycleState = (typeof SESSION_LIFECYCLE_STATES)[number];
/** Canonical public name for a session's lifecycle state. */
export type SessionStatus = SessionLifecycleState;
/** Lifecycle states that may overlap another live session's date range. */
export const SESSION_OVERLAP_STATES: readonly SessionStatus[] = ["draft", "open", "in_progress"];

/**
 * Allowed explicit transitions. There is no jump: a session must pass through `open` before it can
 * start (`draft → in_progress` was an illegal shortcut), and re-opening a started session is not
 * possible. Terminal states only move to `archived`.
 */
export const SESSION_TRANSITIONS: Readonly<
  Record<SessionLifecycleState, readonly SessionLifecycleState[]>
> = {
  draft: ["open", "cancelled"],
  open: ["draft", "in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: ["archived"],
  cancelled: ["archived"],
  archived: [],
};

/** States in which students may be enrolled. */
export const SESSION_ENROLLABLE_STATES: readonly SessionLifecycleState[] = ["open", "in_progress"];

const LEGACY_STATUS: Record<string, SessionLifecycleState> = {
  active: "in_progress",
  upcoming: "open",
  inactive: "archived",
};

/**
 * Lenient read-path mapping: legacy or unknown values fall back to `draft` so a hand-edited row can
 * still be rendered. **Never** use this on a write path — use {@link parseSessionStatus}.
 */
export function normalizeSessionStatus(raw: string | null | undefined): SessionLifecycleState {
  const value = (raw ?? "").trim().toLowerCase();
  if ((SESSION_LIFECYCLE_STATES as readonly string[]).includes(value))
    return value as SessionLifecycleState;
  return LEGACY_STATUS[value] ?? "draft";
}

/** A write-path status value that is neither a lifecycle state nor a known legacy alias. */
export class InvalidSessionStatusError extends Error {
  readonly code = "invalid_session_status";
  constructor(readonly raw: unknown) {
    super(`Unknown session status: ${String(raw ?? "")}`);
    this.name = "InvalidSessionStatusError";
  }
}

/**
 * Strict write-path parsing: lifecycle states plus the legacy aliases (`active`, `upcoming`,
 * `inactive`) are accepted, anything else is rejected. This stops a typo from silently downgrading
 * an `open` session to `draft` through the lenient normalizer.
 */
export function parseSessionStatus(raw: unknown): SessionLifecycleState {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if ((SESSION_LIFECYCLE_STATES as readonly string[]).includes(value))
    return value as SessionLifecycleState;
  const legacy = LEGACY_STATUS[value];
  if (legacy) return legacy;
  throw new InvalidSessionStatusError(raw);
}

/** Zod write-path schema: accepts the legacy aliases, rejects every other string. */
export const sessionStatusSchema = z.preprocess(
  (raw) =>
    typeof raw === "string"
      ? (LEGACY_STATUS[raw.trim().toLowerCase()] ?? raw.trim().toLowerCase())
      : raw,
  z.enum(SESSION_LIFECYCLE_STATES),
);

/** Whether `from → to` is a legal transition (same state is a no-op). */
export function canTransitionSession(from: string, to: string): boolean {
  const source = normalizeSessionStatus(from);
  const target = normalizeSessionStatus(to);
  return source === target || SESSION_TRANSITIONS[source].includes(target);
}

/** Once started, structural edits are restricted; terminal states are read-only. */
export function isSessionStructureLocked(status: string): boolean {
  return normalizeSessionStatus(status) !== "draft" && normalizeSessionStatus(status) !== "open";
}

export function isSessionReadOnly(status: string): boolean {
  const state = normalizeSessionStatus(status);
  return state === "completed" || state === "cancelled" || state === "archived";
}

/** True when the session accepts new enrollments (the registration link/eligibility gate). */
export function isSessionEnrollable(status: string): boolean {
  return SESSION_ENROLLABLE_STATES.includes(normalizeSessionStatus(status));
}

// ─── Phase derivation (the requested 8-state model, without new persisted states) ───────────────

export const SESSION_PHASES = [
  "planning",
  "enrollment",
  "teaching",
  "exams",
  "completed",
  "closed",
  "archived",
] as const;
export type SessionPhase = (typeof SESSION_PHASES)[number];

/** Minimal calendar-event shape needed to detect the exam period. */
export interface SessionPhaseEvent {
  kind: string;
  startOn: string;
  endOn: string;
  deletedAt?: string | null;
}

export interface SessionPhaseInput {
  status: string;
  startDate?: string | null;
  endDate?: string | null;
  deletedAt?: string | null;
}

/**
 * Maps a session onto the eight phases the product talks about:
 * Draft/Planning → `planning`; Open for Enrollment → `enrollment`; Active → `teaching`;
 * Exams → `exams` (inside an `exam_period` calendar event); Completed → `completed`;
 * Closed → `closed` (cancelled / lifecycle-archived); Archived (trash) → `archived`.
 */
export function deriveSessionPhase(
  session: SessionPhaseInput,
  options: { today: string; events?: readonly SessionPhaseEvent[] },
): SessionPhase {
  if (session.deletedAt) return "archived";
  const state = normalizeSessionStatus(session.status);
  if (state === "archived" || state === "cancelled") return "closed";
  if (state === "completed") return "completed";
  if (state === "draft") return "planning";
  const today = (options.today ?? "").slice(0, 10);
  const start = (session.startDate ?? "").slice(0, 10);
  if (state === "open") return start && today >= start ? "enrollment" : "planning";
  const inExamPeriod = (options.events ?? []).some(
    (event) =>
      !event.deletedAt &&
      event.kind === "exam_period" &&
      event.startOn.slice(0, 10) <= today &&
      today <= event.endOn.slice(0, 10),
  );
  return inExamPeriod ? "exams" : "teaching";
}

// ─── Transition guards ──────────────────────────────────────────────────────────────────────────

export const SESSION_TRANSITION_VIOLATIONS = [
  "illegal_transition",
  "reason_required",
  "session_has_enrollments",
  "session_has_activity",
  "end_date_required",
  "completion_before_end_date",
  "budget_required",
] as const;
export type SessionTransitionViolation = (typeof SESSION_TRANSITION_VIOLATIONS)[number];

/** Context read by the guards (counts are only required for the transitions that use them). */
export interface SessionTransitionContext {
  /** Workspace business day (`YYYY-MM-DD`). */
  today: string;
  /** Seat-holding enrollments (cancelled/withdrawn/… excluded). */
  liveEnrollments?: number;
  /** Attendance rows recorded for the session (active or archived). */
  attendanceRows?: number;
  /** Exam results recorded for the session's classes. */
  examResults?: number;
  /** Whether any class of the session has a budget plan. */
  hasBudget?: boolean;
  /** Sessions → Setup → Preferences `requireBudget`. */
  requireBudget?: boolean;
  endDate?: string | null;
  /** Cancellation reason (≥3 chars) — required on every cancel path. */
  reason?: string | null;
}

/** Violations an authorized `sessions.override_lock` + reason may waive. */
const OVERRIDABLE_VIOLATIONS: ReadonlySet<SessionTransitionViolation> = new Set([
  "completion_before_end_date",
]);

export interface SessionTransitionEvaluation {
  allowed: boolean;
  /** Same-state write: legal and side-effect free. */
  noop: boolean;
  violations: SessionTransitionViolation[];
  /** Subset of `violations` that an authorized override may waive. */
  overridable: SessionTransitionViolation[];
}

/**
 * Pure guard table for a session transition. Callers load the counts from the store and pass the
 * workspace business day, so the rule lives in one place and is unit-testable without a database.
 */
export function evaluateSessionTransition(
  from: string,
  to: string,
  ctx: SessionTransitionContext,
): SessionTransitionEvaluation {
  const source = normalizeSessionStatus(from);
  const target = normalizeSessionStatus(to);
  if (source === target) {
    return { allowed: true, noop: true, violations: [], overridable: [] };
  }
  const violations: SessionTransitionViolation[] = [];
  if (!SESSION_TRANSITIONS[source].includes(target)) violations.push("illegal_transition");

  if (target === "cancelled" && (ctx.reason ?? "").trim().length < 3)
    violations.push("reason_required");

  // Re-opening a session that already has enrollment or academic activity corrupts the intake:
  // it becomes non-enrollable while live enrollments remain attached to it.
  if (source === "open" && target === "draft") {
    if ((ctx.liveEnrollments ?? 0) > 0) violations.push("session_has_enrollments");
    if ((ctx.attendanceRows ?? 0) > 0 || (ctx.examResults ?? 0) > 0)
      violations.push("session_has_activity");
  }

  // Activation must be intentional: when the tenant requires a budget plan, no budget → no open.
  if (target === "open" && ctx.requireBudget && !ctx.hasBudget) violations.push("budget_required");

  if (target === "completed") {
    const endDate = (ctx.endDate ?? "").slice(0, 10);
    if (!endDate) violations.push("end_date_required");
    else if (endDate > ctx.today) violations.push("completion_before_end_date");
  }

  return {
    allowed: violations.length === 0,
    noop: false,
    violations,
    overridable: violations.filter((violation) => OVERRIDABLE_VIOLATIONS.has(violation)),
  };
}

/** True when every violation can be waived by an authorized override with a reason. */
export function isTransitionFullyOverridable(evaluation: SessionTransitionEvaluation): boolean {
  return (
    evaluation.violations.length > 0 &&
    evaluation.violations.every((violation) => OVERRIDABLE_VIOLATIONS.has(violation))
  );
}
