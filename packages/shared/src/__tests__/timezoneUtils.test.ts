import { describe, expect, it } from "vitest";
import {
  getIanaTimeZoneIds,
  detectBrowserTimezone,
  getTimezoneOffsetMinutes,
  formatTimezoneLabel,
  getTimezoneOptions,
  isValidIanaTimezone,
  normalizeTimezone,
  groupTimezoneOptions,
} from "../timezoneUtils.js";

describe("timezoneUtils", () => {
  describe("getIanaTimeZoneIds", () => {
    it("returns a non-empty list of valid IANA timezone identifiers", () => {
      const ids = getIanaTimeZoneIds();
      expect(ids.length).toBeGreaterThan(0);
      expect(ids.some((id) => id === "Asia/Karachi" || id === "UTC" || id === "Etc/UTC")).toBe(
        true,
      );
    });
  });

  describe("detectBrowserTimezone", () => {
    it("returns a string representing the browser/system timezone", () => {
      const tz = detectBrowserTimezone();
      expect(typeof tz).toBe("string");
      expect(tz.length).toBeGreaterThan(0);
    });
  });

  describe("isValidIanaTimezone and normalizeTimezone", () => {
    it("validates known IANA timezones and rejects invalid ones", () => {
      expect(isValidIanaTimezone("Asia/Karachi")).toBe(true);
      expect(isValidIanaTimezone("UTC")).toBe(true);
      expect(isValidIanaTimezone("Europe/London")).toBe(true);
      expect(isValidIanaTimezone("Invalid/Timezone_Name")).toBe(false);
      expect(isValidIanaTimezone("")).toBe(false);
    });

    it("normalizes stored values falling back appropriately", () => {
      expect(normalizeTimezone("Asia/Dubai")).toBe("Asia/Dubai");
      expect(normalizeTimezone("  Asia/Riyadh  ")).toBe("Asia/Riyadh");
      expect(normalizeTimezone("Invalid/Zone", "America/New_York")).toBe("America/New_York");
      expect(normalizeTimezone(undefined, "UTC")).toBe("UTC");
    });
  });

  describe("getTimezoneOffsetMinutes and formatTimezoneLabel", () => {
    it("calculates offset minutes for Asia/Karachi (UTC+5)", () => {
      const offset = getTimezoneOffsetMinutes("Asia/Karachi", new Date("2026-07-21T00:00:00Z"));
      expect(offset).toBe(300);
    });

    it("formats human-readable labels", () => {
      const labelUTC = formatTimezoneLabel("UTC");
      expect(labelUTC).toBe("UTC");

      const labelKarachi = formatTimezoneLabel("Asia/Karachi");
      expect(labelKarachi).toContain("Karachi");
    });
  });

  describe("getTimezoneOptions and groupTimezoneOptions", () => {
    it("returns sorted options and groups them by region", () => {
      const options = getTimezoneOptions("en");
      expect(options.length).toBeGreaterThan(0);

      const firstOption = options[0];
      expect(firstOption).toHaveProperty("value");
      expect(firstOption).toHaveProperty("label");
      expect(firstOption).toHaveProperty("region");

      const grouped = groupTimezoneOptions(options);
      expect(grouped.length).toBeGreaterThan(0);
      expect(grouped[0]).toHaveProperty("region");
      expect(grouped[0]).toHaveProperty("options");
    });
  });
});
