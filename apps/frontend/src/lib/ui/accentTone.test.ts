import { describe, expect, it } from "vitest";
import { ACCENT_ALIASES, resolveAccentTone } from "./accentTone";
import { CARD_STRIPE_COLORS, getCardStripeClass } from "./cardAccentTokens";
import { ACCENT_MAP, resolveAccent } from "@/components/app/statCardAccent";

describe("shared accent contract", () => {
  it.each(Object.entries(ACCENT_ALIASES))("%s uses %s for icons and stripes", (alias, tone) => {
    expect(resolveAccentTone(alias)).toBe(tone);
    expect(resolveAccent(alias)).toBe(ACCENT_MAP[tone]);
    expect(CARD_STRIPE_COLORS[alias]).toBe(CARD_STRIPE_COLORS[tone]);
    expect(getCardStripeClass(alias)).toBe(resolveAccent(alias).stripe);
  });

  it.each(["text-emerald-600", "INFO", "muted", "unrecognized", "__proto__", "constructor"])(
    "keeps card and stat accents aligned for %s",
    (accent) => {
      expect(getCardStripeClass(accent)).toBe(resolveAccent(accent).stripe);
      expect(typeof getCardStripeClass(accent)).toBe("string");
    },
  );

  it("preserves opt-out stripes and default stat icons", () => {
    expect(getCardStripeClass(undefined)).toBe("");
    expect(resolveAccent(null)).toBe(ACCENT_MAP.primary);
  });
});
