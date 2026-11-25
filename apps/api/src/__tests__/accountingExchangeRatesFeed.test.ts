import { describe, expect, it } from "vitest";
import { resolveFeedCrossRate } from "@mms/mod-accounting/backend/repository";

const row = (
  provider: string,
  base: string,
  quote: string,
  rate: string,
  rateDate = "2026-01-06",
) => ({ provider, base, quote, rate, rateDate });

describe("resolveFeedCrossRate", () => {
  it("triangulates two quotes within one base", () => {
    const result = resolveFeedCrossRate(
      "USD",
      "PKR",
      [row("p", "GBP", "USD", "0.80"), row("p", "GBP", "PKR", "302.4")],
      "2026-01-07",
    );

    expect(result).not.toBeNull();
    expect(result?.source).toBe("feed:p");
    expect(Number(result?.rate)).toBe(378);
  });

  it("refuses to triangulate across different bases", () => {
    const result = resolveFeedCrossRate(
      "USD",
      "PKR",
      [row("p", "GBP", "USD", "0.80"), row("p", "EUR", "PKR", "302.4")],
      "2026-01-07",
    );

    expect(result).toBeNull();
  });

  it("returns null when a base is missing one leg", () => {
    const result = resolveFeedCrossRate(
      "USD",
      "PKR",
      [row("p", "GBP", "USD", "0.80")],
      "2026-01-07",
    );

    expect(result).toBeNull();
  });

  it("uses the identity leg when the query currency is the base", () => {
    const result = resolveFeedCrossRate(
      "GBP",
      "PKR",
      [row("p", "GBP", "PKR", "302.4")],
      "2026-01-07",
    );

    expect(result).not.toBeNull();
    expect(Number(result?.rate)).toBe(302.4);
  });
});
