import { describe, expect, it } from "vitest";
import { sumAmounts } from "./obligationsSummaryCalculations";

/**
 * The Summary's headline amount used a plain float `reduce`, while every other total in the module
 * accumulates integer cents. Two summation styles in one feature means the headline can disagree
 * with the sections that add up the same rows (frontend audit).
 */
describe("sumAmounts", () => {
  it("sums 2-dp amounts without float drift", () => {
    // The classic case: 0.1 + 0.2 === 0.30000000000000004 in IEEE-754.
    expect(sumAmounts([0.1, 0.2])).toBe(0.3);
    expect(sumAmounts([50000.1, 50000.2])).toBe(100000.3);
    expect(sumAmounts([0.01, 0.02, 0.03])).toBe(0.06);
  });

  it("returns 0 for an empty list", () => {
    expect(sumAmounts([])).toBe(0);
  });

  it("ignores non-finite entries instead of poisoning the total", () => {
    expect(sumAmounts([10, Number.NaN, 5, Number.POSITIVE_INFINITY])).toBe(15);
  });

  it("keeps large totals exact to the cent", () => {
    expect(sumAmounts([1234567.89, 8765432.11])).toBe(10_000_000);
  });
});
