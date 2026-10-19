import { describe, expect, it } from "vitest";
import { postponedSessionDates, sessionPostponeBodySchema } from "./sessionLifecycleOps.js";

describe("postponedSessionDates", () => {
  it("given a later start, should move the end by the same number of days across months", () => {
    // Assert
    expect(
      postponedSessionDates({ startDate: "2026-01-25", endDate: "2026-03-31" }, "2026-02-04"),
    ).toEqual({
      startDate: "2026-02-04",
      endDate: "2026-04-10",
    });
  });

  it("given no end date, should only move the start", () => {
    // Assert
    expect(postponedSessionDates({ startDate: "2026-01-25", endDate: "" }, "2026-02-01")).toEqual({
      startDate: "2026-02-01",
      endDate: null,
    });
  });

  it("given an impossible date or blank reason, should reject the body", () => {
    // Assert
    expect(
      sessionPostponeBodySchema.safeParse({ startDate: "2026-02-30", reason: "Delay" }).success,
    ).toBe(false);
    expect(
      sessionPostponeBodySchema.safeParse({ startDate: "2026-02-10", reason: " " }).success,
    ).toBe(false);
  });
});
