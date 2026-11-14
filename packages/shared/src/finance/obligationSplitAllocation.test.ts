import { describe, expect, it } from "vitest";
import { allocateWakalaSplits } from "./obligationSplitAllocation.js";

const sum = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0);

describe("allocateWakalaSplits", () => {
  it("allocates an exact whole split without residue", () => {
    expect(allocateWakalaSplits(10_000, [60, 40])).toEqual([6_000, 4_000]);
  });

  it("normalises by the sum of the rules, not by 100", () => {
    // 40/40 is a 50/50 split; dividing by 100 would leave half the receipt unallocated.
    expect(allocateWakalaSplits(1_000, [40, 40])).toEqual([500, 500]);
    // …and a 180 % rule set is still a 90/90 split.
    expect(allocateWakalaSplits(1_000, [90, 90])).toEqual([500, 500]);
  });

  it("never returns a negative or zero-sum-wrecking line for a sub-cent split", () => {
    // Four 25 % rules on 2 cents: rounding each independently produced 4 cents of credits
    // against a 2-cent debit, and the residual pushed the largest line to -1.
    const cents = allocateWakalaSplits(2, [25, 25, 25, 25]);
    expect(cents).toEqual([1, 1, 0, 0]);
    expect(cents.every((value) => value >= 0)).toBe(true);
    expect(sum(cents)).toBe(2);
  });

  it("gives the leftover cent to the largest remainder, stably", () => {
    // 1 cent across 1/1/1: every remainder ties, so the first rule takes it.
    expect(allocateWakalaSplits(1, [1, 1, 1])).toEqual([1, 0, 0]);
    // 100 cents across 33.33/33.33/33.34: the largest remainder is the third rule.
    expect(allocateWakalaSplits(100, [33.33, 33.33, 33.34])).toEqual([33, 33, 34]);
  });

  it("returns one entry per rule and never allocates more than the total", () => {
    for (const percentages of [[100], [50, 50], [70, 20, 10], [33, 33, 33]]) {
      const cents = allocateWakalaSplits(9_999, percentages);
      expect(cents).toHaveLength(percentages.length);
      expect(sum(cents)).toBeLessThanOrEqual(9_999);
    }
  });

  it("leaves a degenerate all-zero rule set short, so the caller's balance check rejects it", () => {
    const cents = allocateWakalaSplits(1_000, [0, 0]);
    expect(sum(cents)).toBeLessThan(1_000);
  });

  it("handles no rules and non-positive totals", () => {
    expect(allocateWakalaSplits(1_000, [])).toEqual([]);
    expect(allocateWakalaSplits(0, [50, 50])).toEqual([0, 0]);
    expect(allocateWakalaSplits(-5, [50, 50])).toEqual([0, 0]);
  });
});
