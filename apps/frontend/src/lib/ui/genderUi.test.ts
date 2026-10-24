import { describe, expect, it } from "vitest";
import {
  getGenderIcon,
  getGenderIconClass,
  getGenderTextClass,
  getGenderBadgeTone,
  getGenderBadgeClass,
  getGenderBgClass,
  getGenderBorderClass,
  getGenderAvatarFallbackClass,
  getGenderAccentBarClass,
  getGenderCardAccent,
  normalizeGenderKey,
  isGenderUiKey,
  getGenderThemeConfig,
} from "./genderUi";
import { Mars, Venus, UserRound } from "lucide-react";

describe("normalizeGenderKey", () => {
  it("maps male/female variants", () => {
    expect(normalizeGenderKey("Male")).toBe("male");
    expect(normalizeGenderKey("FEMALE")).toBe("female");
    expect(normalizeGenderKey("m")).toBe("male");
    expect(normalizeGenderKey("f")).toBe("female");
  });

  it("maps other/unspecified and empty", () => {
    expect(normalizeGenderKey("other")).toBe("other");
    expect(normalizeGenderKey("unspecified")).toBe("unspecified");
    expect(normalizeGenderKey("")).toBe("");
    expect(normalizeGenderKey(null)).toBe("");
    expect(normalizeGenderKey("custom-value")).toBe("other");
  });
});

describe("getGenderIcon", () => {
  it("returns distinct Lucide icons for male and female", () => {
    expect(getGenderIcon("male")).toBe(Mars);
    expect(getGenderIcon("female")).toBe(Venus);
    expect(getGenderIcon("male")).not.toBe(getGenderIcon("female"));
    expect(getGenderIcon("")).toBe(UserRound);
    expect(getGenderIcon("other")).toBe(UserRound);
  });
});

describe("getGenderIconClass and getGenderTextClass", () => {
  it("uses distinct semantic tones for male and female", () => {
    expect(getGenderIconClass("male")).toBe("text-info");
    expect(getGenderIconClass("female")).toBe("text-secondary");
    expect(getGenderIconClass("")).toBe("text-muted-foreground");
    expect(getGenderTextClass("male")).toBe("text-info");
    expect(getGenderTextClass("female")).toBe("text-secondary");
  });
});

describe("getGenderBadgeTone and getGenderCardAccent", () => {
  it("returns info for male and secondary for female", () => {
    expect(getGenderBadgeTone("male")).toBe("info");
    expect(getGenderBadgeTone("female")).toBe("secondary");
    expect(getGenderBadgeTone("")).toBe("primary");
    expect(getGenderCardAccent("male")).toBe("info");
    expect(getGenderCardAccent("female")).toBe("secondary");
  });
});

describe("getGenderBadgeClass", () => {
  it("returns centralized badge styles", () => {
    expect(getGenderBadgeClass("male")).toContain("text-info");
    expect(getGenderBadgeClass("female")).toContain("text-secondary");
    expect(getGenderBadgeClass("")).toContain("text-muted-foreground");
  });
});

describe("getGenderBgClass and getGenderBorderClass", () => {
  it("returns themed background and border tokens", () => {
    expect(getGenderBgClass("male")).toBe("bg-info/10");
    expect(getGenderBgClass("female")).toBe("bg-secondary/10");
    expect(getGenderBorderClass("male")).toBe("border-info/30");
    expect(getGenderBorderClass("female")).toBe("border-secondary/30");
  });
});

describe("getGenderAvatarFallbackClass", () => {
  it("returns themed avatar fallback classes for male and female", () => {
    expect(getGenderAvatarFallbackClass("male")).toBe("bg-info/15 text-info ring-1 ring-info/30");
    expect(getGenderAvatarFallbackClass("female")).toBe(
      "bg-secondary/15 text-secondary ring-1 ring-secondary/35",
    );
    expect(getGenderAvatarFallbackClass(undefined, "usr-1")).toContain("bg-");
  });
});

describe("getGenderAccentBarClass", () => {
  it("returns themed accent bars for selected, male, female and default", () => {
    expect(getGenderAccentBarClass(true, "male")).toBe("bg-primary/70 group-hover:bg-primary");
    expect(getGenderAccentBarClass(false, "male")).toBe("bg-info/50 group-hover:bg-info");
    expect(getGenderAccentBarClass(false, "female")).toBe(
      "bg-secondary/50 group-hover:bg-secondary",
    );
    expect(getGenderAccentBarClass(false, undefined)).toContain("bg-muted-foreground");
  });
});

describe("isGenderUiKey", () => {
  it("identifies canonical keys", () => {
    expect(isGenderUiKey("male")).toBe(true);
    expect(isGenderUiKey("female")).toBe(true);
    expect(isGenderUiKey("other")).toBe(true);
    expect(isGenderUiKey("unspecified")).toBe(true);
    expect(isGenderUiKey("random")).toBe(false);
    expect(isGenderUiKey(null)).toBe(false);
  });
});

describe("getGenderThemeConfig", () => {
  it("returns bundled theme configuration for female", () => {
    const config = getGenderThemeConfig("female");
    expect(config.key).toBe("female");
    expect(config.tone).toBe("secondary");
    expect(config.iconClass).toBe("text-secondary");
    expect(config.bgClass).toBe("bg-secondary/10");
    expect(config.borderClass).toBe("border-secondary/30");
  });

  it("returns bundled theme configuration for male", () => {
    const config = getGenderThemeConfig("male");
    expect(config.key).toBe("male");
    expect(config.tone).toBe("info");
    expect(config.iconClass).toBe("text-info");
    expect(config.bgClass).toBe("bg-info/10");
    expect(config.borderClass).toBe("border-info/30");
  });
});
