import { describe, expect, it } from "vitest";
import {
  getGenderAccentBarClass,
  getGenderCardAccent,
  getGenderBorderClass,
  getGenderBgClass,
} from "./directoryCardAccent";

describe("directoryCardAccent module exports", () => {
  it("exports getGenderAccentBarClass with correct behavior", () => {
    expect(getGenderAccentBarClass(true, "male")).toContain("bg-primary/70");
    expect(getGenderAccentBarClass(false, "male")).toContain("bg-info/50");
    expect(getGenderAccentBarClass(false, "female")).toContain("bg-secondary/50");
    expect(getGenderAccentBarClass(false, undefined)).toContain("bg-muted-foreground");
  });

  it("exports getGenderCardAccent with correct behavior", () => {
    expect(getGenderCardAccent("male")).toBe("info");
    expect(getGenderCardAccent("female")).toBe("secondary");
    expect(getGenderCardAccent(undefined)).toBe("primary");
  });

  it("exports getGenderBorderClass and getGenderBgClass with correct tokens", () => {
    expect(getGenderBorderClass("male")).toBe("border-info/30");
    expect(getGenderBorderClass("female")).toBe("border-secondary/30");
    expect(getGenderBgClass("male")).toBe("bg-info/10");
    expect(getGenderBgClass("female")).toBe("bg-secondary/10");
  });
});
