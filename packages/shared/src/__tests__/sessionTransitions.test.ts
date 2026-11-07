import { describe, expect, it } from "vitest";
import {
  InvalidSessionStatusError,
  SESSION_LIFECYCLE_STATES,
  SESSION_TRANSITIONS,
  canTransitionSession,
  deriveSessionPhase,
  evaluateSessionTransition,
  isTransitionFullyOverridable,
  normalizeSessionStatus,
  parseSessionStatus,
  sessionStatusSchema,
} from "../sessions/sessionTransitions.js";
import { endDateBoundViolations } from "../sessions/sessionLifecycle.js";
import {
  canEvaluateSessionCompletion,
  canIssueSessionCertificates,
} from "../sessions/sessionCompletion.js";

describe("session transition matrix", () => {
  it("declares exactly the allowed targets per state and no illegal jump", () => {
    expect(SESSION_TRANSITIONS).toEqual({
      draft: ["open", "cancelled"],
      open: ["draft", "in_progress", "cancelled"],
      in_progress: ["completed", "cancelled"],
      completed: ["archived"],
      cancelled: ["archived"],
      archived: [],
    });
    // A started session must pass through Open (the old matrix allowed draft → in_progress).
    expect(canTransitionSession("draft", "in_progress")).toBe(false);
    expect(canTransitionSession("open", "in_progress")).toBe(true);
    expect(canTransitionSession("archived", "draft")).toBe(false);
    expect(canTransitionSession("completed", "in_progress")).toBe(false);
  });

  it("treats the same state as a legal no-op", () => {
    for (const state of SESSION_LIFECYCLE_STATES) {
      expect(canTransitionSession(state, state)).toBe(true);
    }
  });

  it("parses legacy aliases on write and rejects unknown values", () => {
    expect(parseSessionStatus("active")).toBe("in_progress");
    expect(parseSessionStatus(" UPCOMING ")).toBe("open");
    expect(parseSessionStatus("inactive")).toBe("archived");
    expect(() => parseSessionStatus("planning")).toThrow(InvalidSessionStatusError);
    expect(normalizeSessionStatus("planning")).toBe("draft");
    expect(sessionStatusSchema.parse("active")).toBe("in_progress");
    expect(sessionStatusSchema.safeParse("planning").success).toBe(false);
  });
});

describe("deriveSessionPhase", () => {
  const today = "2026-06-15";

  it("maps the requested eight phases onto the six persisted states", () => {
    expect(deriveSessionPhase({ status: "draft" }, { today })).toBe("planning");
    expect(deriveSessionPhase({ status: "open", startDate: "2026-07-01" }, { today })).toBe(
      "planning",
    );
    expect(deriveSessionPhase({ status: "open", startDate: "2026-06-01" }, { today })).toBe(
      "enrollment",
    );
    expect(deriveSessionPhase({ status: "in_progress" }, { today })).toBe("teaching");
    expect(
      deriveSessionPhase(
        { status: "in_progress", startDate: "2026-06-01", endDate: "2026-06-30" },
        {
          today,
          events: [{ kind: "exam_period", startOn: "2026-06-10", endOn: "2026-06-20" }],
        },
      ),
    ).toBe("exams");
    expect(deriveSessionPhase({ status: "completed" }, { today })).toBe("completed");
    expect(deriveSessionPhase({ status: "cancelled" }, { today })).toBe("closed");
    expect(deriveSessionPhase({ status: "archived" }, { today })).toBe("closed");
    expect(
      deriveSessionPhase({ status: "completed", deletedAt: "2026-06-01T00:00:00Z" }, { today }),
    ).toBe("archived");
  });
});

describe("evaluateSessionTransition", () => {
  const base = { today: "2026-06-15" } as const;

  it("rejects an illegal jump", () => {
    const evaluation = evaluateSessionTransition("draft", "in_progress", base);
    expect(evaluation.allowed).toBe(false);
    expect(evaluation.violations).toContain("illegal_transition");
    expect(isTransitionFullyOverridable(evaluation)).toBe(false);
  });

  it("requires a cancellation reason on every path", () => {
    expect(
      evaluateSessionTransition("open", "cancelled", { ...base, reason: "" }).violations,
    ).toContain("reason_required");
    expect(
      evaluateSessionTransition("open", "cancelled", { ...base, reason: "Teacher left" }),
    ).toMatchObject({ allowed: true, violations: [] });
  });

  it("refuses re-opening a session that already has enrollments or activity", () => {
    expect(
      evaluateSessionTransition("open", "draft", { ...base, liveEnrollments: 2 }).violations,
    ).toContain("session_has_enrollments");
    expect(
      evaluateSessionTransition("open", "draft", { ...base, attendanceRows: 1 }).violations,
    ).toContain("session_has_activity");
    expect(evaluateSessionTransition("open", "draft", base)).toMatchObject({ allowed: true });
  });

  it("gates activation on the budget preference", () => {
    expect(
      evaluateSessionTransition("draft", "open", {
        ...base,
        requireBudget: true,
        hasBudget: false,
      }).violations,
    ).toContain("budget_required");
    expect(
      evaluateSessionTransition("draft", "open", {
        ...base,
        requireBudget: true,
        hasBudget: true,
      }),
    ).toMatchObject({ allowed: true });
  });

  it("requires the end date and refuses completing before it (overridable)", () => {
    expect(evaluateSessionTransition("in_progress", "completed", base).violations).toContain(
      "end_date_required",
    );
    const early = evaluateSessionTransition("in_progress", "completed", {
      ...base,
      endDate: "2026-07-01",
    });
    expect(early.violations).toEqual(["completion_before_end_date"]);
    expect(isTransitionFullyOverridable(early)).toBe(true);
    expect(
      evaluateSessionTransition("in_progress", "completed", {
        ...base,
        endDate: "2026-06-01",
      }),
    ).toMatchObject({ allowed: true });
  });

  it("returns a no-op for the same state", () => {
    expect(evaluateSessionTransition("open", "open", base)).toMatchObject({
      allowed: true,
      noop: true,
    });
  });
});

describe("endDateBoundViolations", () => {
  it("flags a shrink below recorded attendance or the current day", () => {
    expect(
      endDateBoundViolations({
        previousEndDate: "2026-06-30",
        nextEndDate: "2026-06-10",
        lastAttendanceDate: "2026-06-20",
        today: "2026-06-15",
      }),
    ).toEqual(["endDate"]);
    expect(
      endDateBoundViolations({
        previousEndDate: "2026-06-30",
        nextEndDate: "2026-06-10",
        lastEnrollmentEnd: "2026-06-12",
        today: "2026-06-15",
      }),
    ).toEqual(["endDate"]);
  });

  it("allows extending and a shrink that clears every bound", () => {
    expect(
      endDateBoundViolations({ previousEndDate: "2026-06-30", nextEndDate: "2026-07-31" }),
    ).toEqual([]);
    expect(
      endDateBoundViolations({
        previousEndDate: "2026-06-30",
        nextEndDate: "2026-06-10",
        lastAttendanceDate: "2026-06-01",
        today: "2026-06-05",
      }),
    ).toEqual([]);
  });
});

describe("completion window", () => {
  it("allows evaluation only once the session has ended", () => {
    expect(
      canEvaluateSessionCompletion({ status: "open", endDate: "2026-01-01", today: "2026-06-01" }),
    ).toBe(false);
    expect(
      canEvaluateSessionCompletion({
        status: "in_progress",
        endDate: "2026-06-01",
        today: "2026-06-01",
      }),
    ).toBe(true);
    expect(
      canEvaluateSessionCompletion({
        status: "in_progress",
        endDate: "2026-07-01",
        today: "2026-06-01",
      }),
    ).toBe(false);
    expect(
      canEvaluateSessionCompletion({ status: "completed", endDate: null, today: "2026-06-01" }),
    ).toBe(true);
  });

  it("issues certificates only for a completed, ended session", () => {
    expect(
      canIssueSessionCertificates({
        status: "completed",
        endDate: "2026-05-01",
        today: "2026-06-01",
      }),
    ).toBe(true);
    expect(
      canIssueSessionCertificates({
        status: "completed",
        endDate: "2026-07-01",
        today: "2026-06-01",
      }),
    ).toBe(false);
    expect(
      canIssueSessionCertificates({
        status: "in_progress",
        endDate: "2026-05-01",
        today: "2026-06-01",
      }),
    ).toBe(false);
  });
});
