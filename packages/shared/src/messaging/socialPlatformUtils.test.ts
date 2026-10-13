import { describe, it, expect } from "vitest";
import { formatSocialPlatformUrl, isChronologicalDateRangeValid } from "./socialPlatformUtils.js";

describe("formatSocialPlatformUrl", () => {
  it("leaves full URLs untouched", () => {
    expect(formatSocialPlatformUrl("Twitter", "https://x.com/madrasa")).toBe(
      "https://x.com/madrasa",
    );
    expect(formatSocialPlatformUrl("Instagram", "http://instagram.com/madrasa")).toBe(
      "http://instagram.com/madrasa",
    );
  });

  it("formats twitter / x handles with @ prefix", () => {
    expect(formatSocialPlatformUrl("Twitter", "@madrasa")).toBe("https://x.com/madrasa");
    expect(formatSocialPlatformUrl("X", "madrasa_net")).toBe("https://x.com/madrasa_net");
  });

  it("formats instagram, facebook, and linkedin handles", () => {
    expect(formatSocialPlatformUrl("Instagram", "@school")).toBe("https://instagram.com/school");
    expect(formatSocialPlatformUrl("Facebook", "madrasaofficial")).toBe(
      "https://facebook.com/madrasaofficial",
    );
    expect(formatSocialPlatformUrl("LinkedIn", "my-school")).toBe(
      "https://linkedin.com/in/my-school",
    );
  });

  it("formats youtube and github handles", () => {
    expect(formatSocialPlatformUrl("YouTube", "madrasachannel")).toBe(
      "https://youtube.com/@madrasachannel",
    );
    expect(formatSocialPlatformUrl("GitHub", "@techmire")).toBe("https://github.com/techmire");
  });

  it("handles empty or whitespace-only inputs", () => {
    expect(formatSocialPlatformUrl("Twitter", "")).toBe("");
    expect(formatSocialPlatformUrl("Twitter", "   ")).toBe("");
  });

  it("prepends https:// to domain-style inputs without protocol", () => {
    expect(formatSocialPlatformUrl("Website", "example.org/profile")).toBe(
      "https://example.org/profile",
    );
  });
});

describe("isChronologicalDateRangeValid", () => {
  it("returns true when either date is missing", () => {
    expect(isChronologicalDateRangeValid(undefined, "2024-01-01")).toBe(true);
    expect(isChronologicalDateRangeValid("2024-01-01", undefined)).toBe(true);
    expect(isChronologicalDateRangeValid("", "")).toBe(true);
  });

  it("returns true when start date is before or equal to end date", () => {
    expect(isChronologicalDateRangeValid("2020-01-01", "2022-05-15")).toBe(true);
    expect(isChronologicalDateRangeValid("2022-01-01", "2022-01-01")).toBe(true);
    expect(isChronologicalDateRangeValid("2018", "2022")).toBe(true);
    expect(isChronologicalDateRangeValid("2022", "2022")).toBe(true);
  });

  it("returns false when start date is after end date", () => {
    expect(isChronologicalDateRangeValid("2025-06-01", "2022-01-01")).toBe(false);
    expect(isChronologicalDateRangeValid("2025", "2020")).toBe(false);
  });
});
