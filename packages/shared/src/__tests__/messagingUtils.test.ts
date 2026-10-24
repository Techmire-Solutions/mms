import { describe, expect, it } from "vitest";
import {
  personalizeMessage,
  findUnknownPersonalizationTokens,
  validateRecipientAddress,
  MESSAGING_VARIABLE_TOKENS,
  appendVariableToken,
  insertVariableTokenAt,
} from "../core/utils.js";
import { calculateSmsSegments } from "../messaging/smsUtils.js";
import {
  mergeMessageTemplates,
  DEFAULT_MESSAGE_TEMPLATES,
  type MessageTemplate,
} from "../messaging/messagingSchemas.js";

describe("messagingUtils", () => {
  describe("personalizeMessage", () => {
    it("substitutes basic tokens correctly", () => {
      const result = personalizeMessage("Hello {name}, your first name is {first_name}.", {
        id: 1,
        name: "Ali Raza",
        phone: "+923001234567",
      });
      expect(result).toBe("Hello Ali Raza, your first name is Ali.");
    });

    it("handles fallback default values when token is missing", () => {
      const result = personalizeMessage(
        "Dear {name|Valued Parent}, your balance of {amount|0 PKR} is due on {due_date|today}.",
        {
          id: 2,
          name: "",
          phone: "+923001234567",
        },
      );
      expect(result).toBe("Dear Valued Parent, your balance of 0 PKR is due on today.");
    });

    it("interpolates options parameters when provided", () => {
      const result = personalizeMessage(
        "Welcome to {madrasa_name} on {date}.",
        {
          id: 3,
          name: "Fatima",
          phone: "+923001234567",
        },
        { madrasaName: "Madrasa Tul Elm", date: "2026-08-01" },
      );
      expect(result).toBe("Welcome to Madrasa Tul Elm on 2026-08-01.");
    });

    it("substitutes academic tokens properly", () => {
      const result = personalizeMessage(
        "Salaam {name}, student {student_name} (Roll: {roll_number}) in class {class} is {attendance_status}.",
        {
          id: 5,
          name: "Parent Raza",
          studentName: "Hassan Raza",
          rollNumber: "101",
          className: "Hifz 1",
          attendanceStatus: "absent",
        },
      );
      expect(result).toBe(
        "Salaam Parent Raza, student Hassan Raza (Roll: 101) in class Hifz 1 is absent.",
      );
    });

    it("leaves unknown token literals for callers to reject", () => {
      const result = personalizeMessage("Hello {name}, see {custom_field} and {foo|bar}.", {
        id: 4,
        name: "Ali",
        phone: "+923001234567",
      });
      expect(result).toBe("Hello Ali, see {custom_field} and {foo|bar}.");
    });
  });

  describe("findUnknownPersonalizationTokens", () => {
    it("returns empty when all tokens are allowlisted", () => {
      expect(findUnknownPersonalizationTokens("Hello {name} at {madrasa_name|School}")).toEqual([]);
      expect(findUnknownPersonalizationTokens("Alias {school_name}")).toEqual([]);
    });

    it("returns deduped unknown token keys", () => {
      expect(
        findUnknownPersonalizationTokens(
          "Hello {name}, see {custom_field} and {foo|bar} {custom_field}.",
        ),
      ).toEqual(["custom_field", "foo"]);
    });
  });

  describe("validateRecipientAddress", () => {
    it("validates email addresses properly", () => {
      expect(
        validateRecipientAddress(
          { id: 1, name: "Ali", phone: "123", email: "ali@example.com" },
          "email",
        ),
      ).toEqual({
        isValid: true,
        address: "ali@example.com",
        reason: undefined,
      });

      expect(
        validateRecipientAddress(
          { id: 2, name: "Ali", phone: "123", email: "invalid-email" },
          "email",
        ),
      ).toEqual({
        isValid: false,
        address: "invalid-email",
        reason: "invalid_email_format",
      });

      expect(validateRecipientAddress({ id: 3, name: "Ali", phone: "123" }, "email")).toEqual({
        isValid: false,
        address: "",
        reason: "missing_email",
      });
    });

    it("validates phone numbers for SMS / WhatsApp", () => {
      expect(
        validateRecipientAddress({ id: 1, name: "Ali", phone: "+92 300 1234567" }, "whatsapp"),
      ).toEqual({
        isValid: true,
        address: "923001234567",
        reason: undefined,
      });

      expect(validateRecipientAddress({ id: 2, name: "Ali", phone: "123" }, "sms")).toEqual({
        isValid: false,
        address: "123",
        reason: "invalid_phone_format",
      });

      expect(validateRecipientAddress({ id: 3, name: "Ali", phone: "" }, "sms")).toEqual({
        isValid: false,
        address: "",
        reason: "missing_phone",
      });
    });
  });

  describe("calculateSmsSegments", () => {
    it("calculates single GSM 7-bit segment", () => {
      const res = calculateSmsSegments("Hello World");
      expect(res.isUnicode).toBe(false);
      expect(res.segmentLimit).toBe(160);
      expect(res.totalSegments).toBe(1);
      expect(res.remainingInSegment).toBe(149);
    });

    it("detects Unicode encoding for Urdu/Arabic text", () => {
      const res = calculateSmsSegments("السلام علیکم");
      expect(res.isUnicode).toBe(true);
      expect(res.segmentLimit).toBe(70);
      expect(res.totalSegments).toBe(1);
    });
  });

  describe("mergeMessageTemplates", () => {
    it("merges default templates with custom and context templates cleanly", () => {
      const customTemplates = [
        { id: "t1", label: "Overridden Announcement", body: "Custom body" }, // Duplicate ID, should be ignored
        { id: "custom_100", label: "Custom Notice", body: "Custom Notice Body" },
      ];
      const contextTemplates = [{ id: "ctx_1", label: "Context Template", body: "Context Body" }];

      const merged = mergeMessageTemplates(customTemplates, contextTemplates);
      expect(merged).toHaveLength(DEFAULT_MESSAGE_TEMPLATES.length + 2);
      expect(merged.find((t: MessageTemplate) => t.id === "t1")?.label).toBe(
        "General Announcement",
      ); // Preserves base t1
      expect(merged.find((t: MessageTemplate) => t.id === "custom_100")?.label).toBe(
        "Custom Notice",
      );
      expect(merged.find((t: MessageTemplate) => t.id === "ctx_1")?.label).toBe("Context Template");
    });
  });

  describe("variableTokensRegistry", () => {
    it("provides valid variable token registry definitions", () => {
      expect(MESSAGING_VARIABLE_TOKENS.length).toBeGreaterThan(0);
      MESSAGING_VARIABLE_TOKENS.forEach((vt) => {
        expect(vt.token).toMatch(/^\{[a-z_]+\}$/);
        expect(vt.labelKey).toContain("messaging.token");
        expect(typeof vt.fallbackExample).toBe("string");
        expect(vt.fallbackExample.length).toBeGreaterThan(0);
      });
    });
  });

  describe("appendVariableToken", () => {
    it("appends token with space when body is non-empty", () => {
      expect(appendVariableToken("Hello", "{name}")).toBe("Hello {name}");
    });

    it("returns token directly when body is empty", () => {
      expect(appendVariableToken("", "{name}")).toBe("{name}");
    });
  });

  describe("insertVariableTokenAt", () => {
    it("inserts at caret without trailing selection", () => {
      const { next, caret } = insertVariableTokenAt("Hello world", "{name}", 5, 5);
      expect(next).toBe("Hello {name} world");
      expect(caret).toBe("Hello {name}".length);
    });

    it("replaces the selected range", () => {
      const { next, caret } = insertVariableTokenAt("Hello world", "{name}", 6, 11);
      expect(next).toBe("Hello {name}");
      expect(caret).toBe("Hello {name}".length);
    });
  });
});
