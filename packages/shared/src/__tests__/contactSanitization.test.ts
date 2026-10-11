import { describe, it, expect } from "vitest";
import {
  sanitizePhoneForTel,
  sanitizePhoneForSms,
  sanitizePhoneForWhatsApp,
  sanitizeEmailForMailto,
  getContactPhoneActionHrefs,
} from "../contactSanitization.js";

describe("contactSanitization", () => {
  describe("sanitizePhoneForTel", () => {
    it("converts valid international phone to tel:+<e164>", () => {
      expect(sanitizePhoneForTel("+92 300 1234567")).toBe("tel:+923001234567");
      expect(sanitizePhoneForTel("+1 (555) 234-5678")).toBe("tel:+15552345678");
    });

    it("applies default country code if missing", () => {
      expect(sanitizePhoneForTel("03001234567", "+92")).toBe("tel:+923001234567");
    });

    it("preserves a local tel link when no country code is configured", () => {
      expect(sanitizePhoneForTel("03001234567")).toBe("tel:03001234567");
    });

    it("returns null for null, empty or invalid strings", () => {
      expect(sanitizePhoneForTel(null)).toBeNull();
      expect(sanitizePhoneForTel("")).toBeNull();
      expect(sanitizePhoneForTel("   ")).toBeNull();
      expect(sanitizePhoneForTel("abc")).toBeNull();
      expect(sanitizePhoneForTel("12")).toBeNull();
    });
  });

  describe("sanitizePhoneForSms", () => {
    it("converts valid international phone to sms:+<e164>", () => {
      expect(sanitizePhoneForSms("+92 300 1234567")).toBe("sms:+923001234567");
      expect(sanitizePhoneForSms("03001234567", "+92")).toBe("sms:+923001234567");
    });

    it("returns null for null or empty strings", () => {
      expect(sanitizePhoneForSms(null)).toBeNull();
      expect(sanitizePhoneForSms("")).toBeNull();
    });
  });

  describe("sanitizePhoneForWhatsApp", () => {
    it("converts valid international phone to https://wa.me/<digits>", () => {
      expect(sanitizePhoneForWhatsApp("+92 300 1234567")).toBe("https://wa.me/923001234567");
      expect(sanitizePhoneForWhatsApp("+1 555 1234567")).toBe("https://wa.me/15551234567");
    });

    it("converts local phone using default country code", () => {
      expect(sanitizePhoneForWhatsApp("03001234567", "+92")).toBe("https://wa.me/923001234567");
    });

    it("does not build a WhatsApp link without an international code", () => {
      expect(sanitizePhoneForWhatsApp("03001234567")).toBeNull();
    });

    it("returns null for invalid or empty phone", () => {
      expect(sanitizePhoneForWhatsApp(null)).toBeNull();
      expect(sanitizePhoneForWhatsApp("")).toBeNull();
      expect(sanitizePhoneForWhatsApp("123")).toBeNull();
    });
  });

  describe("sanitizeEmailForMailto", () => {
    it("converts valid email to mailto:<email>", () => {
      expect(sanitizeEmailForMailto("info@madrasa.com")).toBe("mailto:info@madrasa.com");
      expect(sanitizeEmailForMailto("  student.test@domain.org  ")).toBe(
        "mailto:student.test@domain.org",
      );
    });

    it("returns null for invalid or empty emails", () => {
      expect(sanitizeEmailForMailto(null)).toBeNull();
      expect(sanitizeEmailForMailto("")).toBeNull();
      expect(sanitizeEmailForMailto("invalid-email")).toBeNull();
      expect(sanitizeEmailForMailto("no@domain")).toBeNull();
    });
  });

  describe("getContactPhoneActionHrefs", () => {
    it("returns bundled action hrefs", () => {
      const hrefs = getContactPhoneActionHrefs("+92 300 1234567");
      expect(hrefs).toEqual({
        tel: "tel:+923001234567",
        sms: "sms:+923001234567",
        whatsapp: "https://wa.me/923001234567",
      });
    });
  });
});
