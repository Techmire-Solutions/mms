import { describe, expect, it } from "vitest";
import {
  hasFieldValue,
  calculateProfileCompleteness,
} from "../contacts/contactProfileCompleteness.js";
import type { Contact, FieldConfig } from "../contacts/contactTypes.js";

describe("contactProfileCompleteness", () => {
  describe("hasFieldValue", () => {
    it("accurately checks filled values", () => {
      expect(hasFieldValue("John")).toBe(true);
      expect(hasFieldValue("  ")).toBe(false);
      expect(hasFieldValue(123)).toBe(true);
      expect(hasFieldValue(NaN)).toBe(false);
      expect(hasFieldValue(null)).toBe(false);
      expect(hasFieldValue(undefined)).toBe(false);
      expect(hasFieldValue(["phone1"])).toBe(true);
      expect(hasFieldValue([])).toBe(false);
      expect(hasFieldValue({ url: "https://example.com" })).toBe(true);
      expect(hasFieldValue({ url: "" })).toBe(false);
    });
  });

  describe("calculateProfileCompleteness", () => {
    const mockFieldConfig: FieldConfig = {
      version: 1,
      enabledTabs: ["basic", "phones"],
      requiredTabs: [],
      formTabs: [
        { key: "basic", label: "Basic Info", enabled: true, order: 1 },
        { key: "phones", label: "Phones", enabled: true, order: 2 },
      ],
      fields: {
        basic: [
          { key: "name", type: "text", label: "Name", required: true, enabled: true, order: 1 },
          { key: "notes", type: "text", label: "Notes", required: false, enabled: true, order: 2 },
        ],
      },
    };

    it("calculates 100% when all required and optional fields are filled", () => {
      const contact: Partial<Contact> = {
        name: "Jane Doe",
        notes: "Some notes",
        phones: [{ label: "Mobile", number: "+123456789" }],
      };
      const score = calculateProfileCompleteness(contact, mockFieldConfig);
      expect(score).toBe(100);
    });

    it("calculates partial completeness score accurately when partially filled", () => {
      const contact: Partial<Contact> = {
        name: "Jane Doe",
      };
      const score = calculateProfileCompleteness(contact, mockFieldConfig);
      expect(score).toBe(70);
    });
  });
});
