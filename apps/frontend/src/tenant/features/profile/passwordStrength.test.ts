import { describe, expect, it } from "vitest";
import { getPasswordStrength } from "./passwordStrength";

describe("getPasswordStrength", () => {
  it("returns no strength for an empty password", () => {
    expect(getPasswordStrength("")).toEqual({ score: 0, colorClass: "bg-muted", key: null });
  });

  it("scores weak, medium, strong, and very strong passwords", () => {
    expect(getPasswordStrength("lowercase")).toEqual({
      score: 1,
      colorClass: "bg-destructive",
      key: "account.passwordStrengthVeryWeak",
    });
    expect(getPasswordStrength("Lowercase")).toEqual({
      score: 3,
      colorClass: "bg-warning",
      key: "account.passwordStrengthMedium",
    });
    expect(getPasswordStrength("Lowercase1")).toEqual({
      score: 3,
      colorClass: "bg-warning",
      key: "account.passwordStrengthMedium",
    });
    expect(getPasswordStrength("Lowercase1!")).toEqual({
      score: 4,
      colorClass: "bg-success/80",
      key: "account.passwordStrengthStrong",
    });
  });

  it("scores a long high-entropy password as very strong", () => {
    expect(getPasswordStrength("k9Q$2mT!vR7#nW4x")).toEqual({
      score: 5,
      colorClass: "bg-success",
      key: "account.passwordStrengthVeryStrong",
    });
  });

  it("penalises a single repeating character", () => {
    const result = getPasswordStrength("aaaaaaaa");
    expect(result.score).toBeLessThanOrEqual(2);
  });
});
