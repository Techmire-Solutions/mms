import { describe, expect, it } from "vitest";
import { capacityLabel, effectiveCapacity, isCapacityFull, spotsLeft } from "./enrollmentCapacity";

describe("enrollment capacity semantics", () => {
  it("treats 0/null/undefined as unlimited, not full", () => {
    expect(effectiveCapacity(0)).toBe(Number.POSITIVE_INFINITY);
    expect(effectiveCapacity(null)).toBe(Number.POSITIVE_INFINITY);
    expect(effectiveCapacity(undefined)).toBe(Number.POSITIVE_INFINITY);
    expect(isCapacityFull(25, 0)).toBe(false);
    expect(spotsLeft(25, 0)).toBe(Number.POSITIVE_INFINITY);
  });

  it("computes finite seats and fullness", () => {
    expect(effectiveCapacity(30)).toBe(30);
    expect(spotsLeft(28, 30)).toBe(2);
    expect(isCapacityFull(30, 30)).toBe(true);
    expect(isCapacityFull(31, 30)).toBe(true);
    expect(capacityLabel(0)).toBe("∞");
    expect(capacityLabel(30)).toBe("30");
  });
});
