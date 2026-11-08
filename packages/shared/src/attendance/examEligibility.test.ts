import { describe, expect, it } from "vitest";
import {
  attendancePctFromCounts,
  evaluateExamEligibility,
  isExamEligible,
} from "./examEligibility.js";

describe("attendancePctFromCounts", () => {
  it("rounds to one decimal the way completion stores it", () => {
    expect(attendancePctFromCounts(3, 4)).toBe(75);
    expect(attendancePctFromCounts(149, 200)).toBe(74.5);
    expect(attendancePctFromCounts(749, 1000)).toBe(74.9);
    expect(attendancePctFromCounts(1, 3)).toBe(33.3);
  });

  it("is null when nothing is countable", () => {
    expect(attendancePctFromCounts(0, 0)).toBeNull();
    expect(attendancePctFromCounts(5, 0)).toBeNull();
  });

  it("clamps impossible counts", () => {
    expect(attendancePctFromCounts(10, 5)).toBe(100);
    expect(attendancePctFromCounts(-1, 5)).toBe(0);
  });
});

describe("evaluateExamEligibility", () => {
  it("is eligible when no gate is configured", () => {
    expect(evaluateExamEligibility({ attendancePct: 10, minPct: null }).state).toBe("eligible");
    expect(evaluateExamEligibility({ attendancePct: 10, minPct: 0 }).state).toBe("eligible");
  });

  it("blocks a student below the threshold", () => {
    const result = evaluateExamEligibility({ attendancePct: 74.9, minPct: 75 });
    expect(result.state).toBe("blocked");
    expect(result.requiredPct).toBe(75);
  });

  it("passes exactly at the threshold", () => {
    expect(evaluateExamEligibility({ attendancePct: 75, minPct: 75 }).state).toBe("eligible");
    expect(evaluateExamEligibility({ attendancePct: 75.0, minPct: 75 }).state).toBe("eligible");
  });

  it("is unknown — not eligible — when there is no countable attendance yet", () => {
    const result = evaluateExamEligibility({ attendancePct: null, minPct: 75 });
    expect(result.state).toBe("unknown");
    expect(isExamEligible(result)).toBe(false);
  });

  it("lets an audited override clear a block", () => {
    const result = evaluateExamEligibility({ attendancePct: 40, minPct: 75, overridden: true });
    expect(result.state).toBe("eligible");
    expect(result.overridden).toBe(true);
  });

  it("does not let an override invent a threshold", () => {
    const result = evaluateExamEligibility({ attendancePct: 40, minPct: null, overridden: true });
    expect(result.state).toBe("eligible");
    expect(result.requiredPct).toBeNull();
    expect(result.overridden).toBe(false);
  });
});
