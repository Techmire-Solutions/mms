import { describe, expect, it } from "vitest";
import {
  getSolidBgClass,
  genderSelectClass,
  genderBadgeClass,
  genderAvatarGradient,
  progressBarClass,
  rateToneClass,
  trendTextClass,
  getCardStripeClass,
  gradeBadgeClass,
  balanceToneClass,
  SEMANTIC_BG,
  SEMANTIC_BADGE,
  AVATAR_GRADIENTS,
  CARD_STRIPE_COLORS,
} from "@/lib/ui/semanticTone";

describe("getSolidBgClass", () => {
  it("returns the solid variant for a known tone", () => {
    expect(getSolidBgClass("success")).toBe(SEMANTIC_BG.successSolid);
    expect(getSolidBgClass("destructive")).toBe(SEMANTIC_BG.destructiveSolid);
    expect(getSolidBgClass("secondary")).toBe(SEMANTIC_BG.secondarySolid);
  });

  it("falls back to primarySolid for unknown tones", () => {
    expect(getSolidBgClass("nope")).toBe(SEMANTIC_BG.primarySolid);
  });
});

describe("genderSelectClass", () => {
  it("returns the idle class when not selected", () => {
    expect(genderSelectClass("male", false)).toContain("text-muted-foreground");
  });

  it("returns male/female/neutral selected classes", () => {
    expect(genderSelectClass("male", true)).toContain("ring-info");
    expect(genderSelectClass("female", true)).toContain("ring-secondary");
    expect(genderSelectClass("other", true)).toContain("ring-primary");
  });
});

describe("genderBadgeClass", () => {
  it("maps male/female/other to badge tones", () => {
    expect(genderBadgeClass("male")).toBe(SEMANTIC_BADGE.info);
    expect(genderBadgeClass("female")).toBe(SEMANTIC_BADGE.secondary);
    expect(genderBadgeClass("other")).toBe(SEMANTIC_BADGE.infoStrong);
  });
});

describe("genderAvatarGradient", () => {
  it("maps male/female/neutral gradients", () => {
    expect(genderAvatarGradient("male")).toBe(AVATAR_GRADIENTS.male);
    expect(genderAvatarGradient("female")).toBe(AVATAR_GRADIENTS.female);
    expect(genderAvatarGradient("unknown")).toBe(AVATAR_GRADIENTS.neutral);
  });
});

describe("progressBarClass", () => {
  it("uses danger/warn/success thresholds", () => {
    expect(progressBarClass(100)).toBe("bg-destructive");
    expect(progressBarClass(85)).toBe("bg-warning");
    expect(progressBarClass(50)).toBe("bg-success");
  });

  it("honours custom thresholds", () => {
    expect(progressBarClass(60, { warn: 50, danger: 90 })).toBe("bg-warning");
  });
});

describe("rateToneClass", () => {
  it("returns good/ok/poor tones", () => {
    expect(rateToneClass(95)).toEqual({ text: "text-success", bar: "bg-success" });
    expect(rateToneClass(80)).toEqual({ text: "text-warning", bar: "bg-warning" });
    expect(rateToneClass(50)).toEqual({ text: "text-destructive", bar: "bg-destructive" });
  });
});

describe("trendTextClass", () => {
  it("returns success/destructive/muted by sign", () => {
    expect(trendTextClass(5)).toBe("text-success");
    expect(trendTextClass(-5)).toBe("text-destructive");
    expect(trendTextClass(0)).toBe("text-muted-foreground");
  });
});

describe("getCardStripeClass", () => {
  it("returns empty for no accent", () => {
    expect(getCardStripeClass()).toBe("");
  });

  it("returns the matching class for a known accent", () => {
    expect(getCardStripeClass("success")).toBe(CARD_STRIPE_COLORS.success);
  });

  it("falls back to primary for unknown accents", () => {
    expect(getCardStripeClass("bogus")).toBe(CARD_STRIPE_COLORS.primary);
  });
});

describe("gradeBadgeClass", () => {
  it("maps each tone and defaults to primary", () => {
    expect(gradeBadgeClass("success")).toBe(SEMANTIC_BADGE.success);
    expect(gradeBadgeClass("info")).toBe(SEMANTIC_BADGE.info);
    expect(gradeBadgeClass("warning")).toBe(SEMANTIC_BADGE.warning);
    expect(gradeBadgeClass("secondary")).toBe(SEMANTIC_BADGE.secondary);
    expect(gradeBadgeClass("destructive")).toBe(SEMANTIC_BADGE.destructive);
    expect(gradeBadgeClass("primary")).toBe(SEMANTIC_BADGE.primary);
    expect(gradeBadgeClass("unknown")).toBe(SEMANTIC_BADGE.primary);
  });
});

describe("balanceToneClass", () => {
  it("returns balanced/unbalanced tones", () => {
    expect(balanceToneClass(true)).toContain("bg-success/10");
    expect(balanceToneClass(false)).toContain("bg-destructive/10");
  });
});
