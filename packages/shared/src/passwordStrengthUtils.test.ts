import { describe, expect, it } from "vitest";
import { estimatePasswordStrength } from "./passwordStrengthUtils.js";

describe("estimatePasswordStrength", () => {
  it("returns score 0 for an empty password", () => {
    expect(estimatePasswordStrength("")).toEqual({ score: 0, entropyBits: 0 });
  });

  it("scores short single-class passwords as very weak or weak", () => {
    expect(estimatePasswordStrength("a").score).toBeLessThanOrEqual(2);
    expect(estimatePasswordStrength("abc").score).toBeLessThanOrEqual(2);
  });

  it("scores mixed-class passwords progressively stronger", () => {
    expect(estimatePasswordStrength("lowercase").score).toBe(1);
    expect(estimatePasswordStrength("Lowercase").score).toBe(3);
    expect(estimatePasswordStrength("Lowercase1").score).toBe(3);
    expect(estimatePasswordStrength("Lowercase1!").score).toBe(4);
  });

  it("scores long high-entropy passwords as very strong", () => {
    expect(estimatePasswordStrength("k9Q$2mT!vR7#nW4x").score).toBe(5);
  });

  it("penalises a single repeating character", () => {
    expect(estimatePasswordStrength("aaaaaaaa").score).toBeLessThanOrEqual(2);
  });

  it("penalises keyboard sequences (e.g. QWERTY runs)", () => {
    expect(estimatePasswordStrength("lowercase").score).toBeLessThanOrEqual(2);
    expect(estimatePasswordStrength("abcdefg123").score).toBeLessThanOrEqual(3);
  });

  it("entropyBits is a non-negative integer", () => {
    const { entropyBits } = estimatePasswordStrength("Lowercase1!");
    expect(Number.isInteger(entropyBits)).toBe(true);
    expect(entropyBits).toBeGreaterThanOrEqual(0);
  });
});
