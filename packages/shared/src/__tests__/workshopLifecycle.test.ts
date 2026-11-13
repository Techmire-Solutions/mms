import { describe, expect, it } from "vitest";
import {
  canTransitionWorkshop,
  deriveWorkshopPhase,
  evaluateWorkshopTransition,
  InvalidWorkshopStatusError,
  isWorkshopWaitlistPromotable,
  normalizeWorkshopStatus,
  parseWorkshopStatus,
  workshopLastDay,
  WORKSHOP_TRANSITIONS,
} from "../workshops/workshopLifecycle.js";
import {
  evaluateWorkshopRegistration,
  resolveWorkshopRegistration,
} from "../workshops/workshopRegistrationRules.js";
import { evaluateWorkshopDateRules } from "../workshops/workshopScheduleRules.js";
import {
  workshopCreateStatusSchema,
  workshopTransitionBodySchema,
} from "../workshops/workshopLifecycleSchemas.js";

const TODAY = "2026-03-10";

describe("workshop lifecycle matrix", () => {
  it("accepts every declared transition and same-state no-ops", () => {
    for (const [from, targets] of Object.entries(WORKSHOP_TRANSITIONS)) {
      for (const to of targets)
        expect(canTransitionWorkshop(from, to), `${from} → ${to}`).toBe(true);
      expect(canTransitionWorkshop(from, from), `${from} → ${from}`).toBe(true);
    }
  });

  it("rejects undeclared transitions", () => {
    expect(canTransitionWorkshop("draft", "completed")).toBe(false);
    expect(canTransitionWorkshop("completed", "open")).toBe(false);
    expect(canTransitionWorkshop("cancelled", "open")).toBe(false);
    expect(canTransitionWorkshop("completed", "cancelled")).toBe(false);
  });

  it("fails closed on an unknown persisted status", () => {
    expect(() => parseWorkshopStatus("pending")).toThrowError(InvalidWorkshopStatusError);
    expect(normalizeWorkshopStatus("pending")).toBe("draft");
  });

  it("keeps the derived last day to the start for one-day workshops", () => {
    expect(workshopLastDay({ startDate: "2026-03-01", endDate: null })).toBe("2026-03-01");
    expect(workshopLastDay({ startDate: null, endDate: null })).toBeNull();
  });

  it("only accepts draft/open at creation", () => {
    expect(workshopCreateStatusSchema.safeParse("draft").success).toBe(true);
    expect(workshopCreateStatusSchema.safeParse("completed").success).toBe(false);
  });
});

describe("deriveWorkshopPhase", () => {
  const base = { status: "open", startDate: "2026-03-08", endDate: "2026-03-12" };

  it("treats the soft-delete marker as archived regardless of status", () => {
    expect(
      deriveWorkshopPhase({ ...base, deletedAt: "2026-03-01T00:00:00Z" }, { today: TODAY }),
    ).toBe("archived");
    expect(
      deriveWorkshopPhase(
        { ...base, status: "completed", deletedAt: "2026-03-01T00:00:00Z" },
        { today: TODAY },
      ),
    ).toBe("archived");
  });

  it("maps the persisted intent first", () => {
    expect(deriveWorkshopPhase({ status: "draft" }, { today: TODAY })).toBe("draft");
    expect(deriveWorkshopPhase({ status: "cancelled" }, { today: TODAY })).toBe("cancelled");
    expect(deriveWorkshopPhase({ status: "completed" }, { today: TODAY })).toBe("completed");
  });

  it("derives the registration window, the ongoing window and the finished tail", () => {
    expect(deriveWorkshopPhase({ ...base, startDate: "2026-04-01" }, { today: TODAY })).toBe(
      "registration_open",
    );
    expect(
      deriveWorkshopPhase({ ...base, registrationDeadline: "2026-03-09" }, { today: TODAY }),
    ).toBe("registration_closed");
    expect(deriveWorkshopPhase(base, { today: TODAY })).toBe("ongoing");
    expect(deriveWorkshopPhase(base, { today: "2026-03-13" })).toBe("finished");
  });

  it("keeps a dateless workshop in registration_open", () => {
    expect(deriveWorkshopPhase({ status: "open" }, { today: TODAY })).toBe("registration_open");
  });
});

describe("evaluateWorkshopRegistration", () => {
  const open = { status: "open", startDate: "2099-01-01", endDate: "2099-01-02", capacity: null };

  it("allows a registration in the open window with a free seat", () => {
    expect(evaluateWorkshopRegistration(open, { today: TODAY, seatsTaken: 0 })).toEqual({
      allowed: true,
      blockers: [],
    });
  });

  it("reports the workshop as closed for every non-open status", () => {
    for (const status of ["draft", "completed", "cancelled"]) {
      expect(
        evaluateWorkshopRegistration({ ...open, status }, { today: TODAY, seatsTaken: 0 }),
      ).toEqual({
        allowed: false,
        blockers: ["workshop_not_open"],
      });
    }
  });

  it("blocks past the deadline, past the last day and when full", () => {
    expect(
      evaluateWorkshopRegistration(
        { ...open, registrationDeadline: "2026-03-09" },
        { today: TODAY, seatsTaken: 0 },
      ).blockers,
    ).toEqual(["deadline_passed"]);
    expect(
      evaluateWorkshopRegistration(
        { ...open, startDate: "2026-03-01", endDate: "2026-03-02" },
        { today: TODAY, seatsTaken: 0 },
      ).blockers,
    ).toEqual(["workshop_ended"]);
    expect(
      evaluateWorkshopRegistration({ ...open, capacity: 2 }, { today: TODAY, seatsTaken: 2 })
        .blockers,
    ).toEqual(["capacity_full"]);
  });

  it("reports every applicable blocker, widest first", () => {
    const evaluation = evaluateWorkshopRegistration(
      {
        status: "open",
        startDate: "2026-03-01",
        endDate: "2026-03-02",
        registrationDeadline: "2026-02-20",
        capacity: 1,
      },
      { today: TODAY, seatsTaken: 1 },
    );
    expect(evaluation.allowed).toBe(false);
    expect(evaluation.blockers).toEqual(["deadline_passed", "workshop_ended", "capacity_full"]);
  });
});

describe("evaluateWorkshopTransition", () => {
  const context = {
    today: TODAY,
    startDate: "2026-03-01",
    endDate: "2026-03-02",
    liveRegistrations: 0,
    certificatesIssued: 0,
  };

  it("treats a same-state write as a no-op", () => {
    expect(evaluateWorkshopTransition("open", "open", context)).toEqual({
      allowed: true,
      noop: true,
      violations: [],
    });
  });

  it("rejects undeclared moves and un-publishing a sold workshop", () => {
    expect(evaluateWorkshopTransition("completed", "open", context).violations).toContain(
      "illegal_transition",
    );
    expect(
      evaluateWorkshopTransition("open", "draft", { ...context, liveRegistrations: 3 }).violations,
    ).toEqual(["workshop_has_registrations"]);
    expect(
      evaluateWorkshopTransition("open", "draft", { ...context, liveRegistrations: 0 }).allowed,
    ).toBe(true);
  });

  it("requires a finished, dated workshop before completion", () => {
    expect(
      evaluateWorkshopTransition("open", "completed", {
        ...context,
        endDate: null,
        startDate: null,
      }).violations,
    ).toEqual(["end_date_required"]);
    expect(
      evaluateWorkshopTransition("open", "completed", { ...context, endDate: "2026-12-31" })
        .violations,
    ).toEqual(["completion_before_end_date"]);
    expect(
      evaluateWorkshopTransition("open", "completed", {
        ...context,
        endDate: "2026-03-02",
        today: "2026-03-03",
      }).allowed,
    ).toBe(true);
  });

  it("refuses to cancel once certificates were issued", () => {
    expect(
      evaluateWorkshopTransition("open", "cancelled", { ...context, certificatesIssued: 1 })
        .violations,
    ).toEqual(["certificates_issued"]);
    expect(evaluateWorkshopTransition("open", "cancelled", context).allowed).toBe(true);
    expect(evaluateWorkshopTransition("draft", "cancelled", context).allowed).toBe(true);
  });
});

describe("workshop date rules", () => {
  it("flags an end before the start and a deadline after the last day", () => {
    expect(evaluateWorkshopDateRules({ startDate: "2026-03-05", endDate: "2026-03-01" })).toEqual([
      "end_before_start",
    ]);
    expect(
      evaluateWorkshopDateRules({
        startDate: "2026-03-01",
        endDate: "2026-03-02",
        registrationDeadline: "2026-03-09",
      }),
    ).toEqual(["deadline_after_end"]);
    expect(
      evaluateWorkshopDateRules({
        startDate: "2026-03-01",
        endDate: "2026-03-02",
        registrationDeadline: "2026-02-28",
      }),
    ).toEqual([]);
  });
});

describe("workshopTransitionBodySchema", () => {
  it("requires a reason of at least three characters when cancelling", () => {
    expect(workshopTransitionBodySchema.safeParse({ to: "cancelled" }).success).toBe(false);
    expect(workshopTransitionBodySchema.safeParse({ to: "cancelled", reason: "  " }).success).toBe(
      false,
    );
    expect(
      workshopTransitionBodySchema.safeParse({ to: "cancelled", reason: "Venue flooded" }).success,
    ).toBe(true);
  });

  it("does not require a reason for other targets", () => {
    expect(workshopTransitionBodySchema.safeParse({ to: "open" }).success).toBe(true);
    expect(workshopTransitionBodySchema.safeParse({ to: "completed" }).success).toBe(true);
    expect(workshopTransitionBodySchema.safeParse({ to: "archived" }).success).toBe(false);
  });
});

describe("workshop span rule", () => {
  it("rejects a run longer than WORKSHOP_MAX_DAYS", () => {
    expect(evaluateWorkshopDateRules({ startDate: "2026-01-01", endDate: "2026-12-31" })).toContain(
      "span_too_long",
    );
    expect(
      evaluateWorkshopDateRules({ startDate: "2026-01-01", endDate: "2026-02-01" }),
    ).not.toContain("span_too_long");
  });
});

describe("resolveWorkshopRegistration (capacity + waitlist)", () => {
  const workshop = {
    status: "open",
    startDate: "2099-01-01",
    endDate: "2099-01-02",
    capacity: 2,
    waitlistEnabled: false,
  };

  it("seats while there is room", () => {
    expect(resolveWorkshopRegistration(workshop, { today: TODAY, seatsTaken: 0 })).toEqual({
      outcome: "seated",
      blockers: [],
    });
  });

  it("blocks when full and the waitlist is off", () => {
    expect(resolveWorkshopRegistration(workshop, { today: TODAY, seatsTaken: 2 })).toEqual({
      outcome: "blocked",
      blockers: ["capacity_full"],
    });
  });

  it("queues when full and the waitlist is on", () => {
    expect(
      resolveWorkshopRegistration(
        { ...workshop, waitlistEnabled: true },
        { today: TODAY, seatsTaken: 2 },
      ),
    ).toEqual({ outcome: "waitlisted", blockers: [] });
  });

  it("never queues for a workshop that cannot happen", () => {
    const full = { ...workshop, capacity: 2, waitlistEnabled: true };
    expect(
      resolveWorkshopRegistration(
        { ...full, startDate: "2026-03-01", endDate: "2026-03-02" },
        { today: TODAY, seatsTaken: 2 },
      ).outcome,
    ).toBe("blocked");
    expect(
      resolveWorkshopRegistration({ ...full, status: "cancelled" }, { today: TODAY, seatsTaken: 2 })
        .outcome,
    ).toBe("blocked");
  });
});

describe("isWorkshopWaitlistPromotable", () => {
  const base = { status: "open", startDate: "2026-03-01", endDate: "2026-03-10" };

  it("promotes while the workshop is open and not past its last day", () => {
    expect(isWorkshopWaitlistPromotable(base, TODAY)).toBe(true);
    expect(isWorkshopWaitlistPromotable(base, "2026-03-11")).toBe(false);
    expect(isWorkshopWaitlistPromotable({ ...base, status: "cancelled" }, TODAY)).toBe(false);
    expect(isWorkshopWaitlistPromotable({ ...base, status: "completed" }, TODAY)).toBe(false);
    expect(isWorkshopWaitlistPromotable({ status: "open" }, TODAY)).toBe(true);
  });
});
