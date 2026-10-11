import { describe, expect, it } from "vitest";
import {
  buildDeviceSmsUri,
  calculateSmsSegments,
  listNonGsmCharacters,
  SMS_HIGH_SEGMENT_WARN,
  SMS_SOFT_CHAR_WARN,
} from "../smsUtils.js";

describe("smsUtils", () => {
  describe("buildDeviceSmsUri", () => {
    it("returns null for empty or invalid phone numbers", () => {
      expect(buildDeviceSmsUri("")).toBeNull();
      expect(buildDeviceSmsUri("   ")).toBeNull();
      expect(buildDeviceSmsUri("123")).toBeNull();
    });

    it("builds a clean sms URI without message body", () => {
      expect(buildDeviceSmsUri("+92 300 1234567")).toBe("sms:+923001234567");
      expect(buildDeviceSmsUri("0300 1234567")).toBe("sms:03001234567");
    });

    it("builds a sms URI with URL encoded message body", () => {
      const uri = buildDeviceSmsUri("+923001234567", "Assalamu Alaikum! Your fee is due.");
      expect(uri).toBe("sms:+923001234567?body=Assalamu%20Alaikum!%20Your%20fee%20is%20due.");
    });
  });

  describe("listNonGsmCharacters", () => {
    it("returns empty for GSM-7 text", () => {
      expect(listNonGsmCharacters("Hello {name} - fee due.")).toEqual([]);
    });

    it("lists curly quotes and emoji once each", () => {
      expect(listNonGsmCharacters("Hello “world” 😀 “again”")).toEqual(["“", "”", "😀"]);
    });
  });

  describe("calculateSmsSegments", () => {
    it("stays single-segment for short GSM-7", () => {
      const result = calculateSmsSegments("Hello parent, fee due tomorrow.");
      expect(result.isUnicode).toBe(false);
      expect(result.totalSegments).toBe(1);
      expect(result.charCount).toBeLessThanOrEqual(160);
    });

    it("switches to unicode when curly quote present", () => {
      const result = calculateSmsSegments("Hello “parent”");
      expect(result.isUnicode).toBe(true);
    });

    it("exports soft-cost thresholds used by composers", () => {
      expect(SMS_SOFT_CHAR_WARN).toBe(320);
      expect(SMS_HIGH_SEGMENT_WARN).toBe(3);
    });
  });
});
