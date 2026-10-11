import { describe, expect, it } from "vitest";
import {
  getContactTags,
  contactsBulkTagBodySchema,
  CONTACT_ACTIVITY_TYPES,
  WHATSAPP_STATUS_VALUES,
} from "../contactEntityTypes.js";

describe("contactEntityTypes", () => {
  describe("WHATSAPP_STATUS_VALUES", () => {
    it("contains all canonical WhatsApp verification statuses", () => {
      expect(WHATSAPP_STATUS_VALUES).toEqual(["PENDING", "REGISTERED", "NOT_REGISTERED", "FAILED"]);
    });
  });

  describe("getContactTags", () => {
    it("returns empty array when contact is null or undefined", () => {
      expect(getContactTags(null)).toEqual([]);
      expect(getContactTags(undefined)).toEqual([]);
      expect(getContactTags({})).toEqual([]);
    });

    it("extracts and deduplicates tags from tags array, dropping empty strings", () => {
      const contact = {
        tags: ["VIP", "Donor", "VIP", "  Student  ", "   ", ""],
      };
      expect(getContactTags(contact)).toEqual(["VIP", "Donor", "Student"]);
    });

    it("extracts and deduplicates tags from comma-delimited tag string, dropping empty parts", () => {
      const contact = {
        tag: "VIP, Donor, VIP, Student, ,  ",
      };
      expect(getContactTags(contact)).toEqual(["VIP", "Donor", "Student"]);
    });
  });

  describe("contactsBulkTagBodySchema", () => {
    it("validates a valid payload with addTags only", () => {
      const valid = {
        ids: ["contact-1", "contact-2"],
        addTags: ["VIP"],
      };
      expect(contactsBulkTagBodySchema.parse(valid)).toEqual(valid);
    });

    it("validates a valid payload with removeTags only", () => {
      const valid = {
        ids: ["contact-1"],
        removeTags: ["Lead"],
      };
      expect(contactsBulkTagBodySchema.parse(valid)).toEqual(valid);
    });

    it("validates a valid payload with both addTags and removeTags", () => {
      const valid = {
        ids: ["contact-1"],
        addTags: ["VIP"],
        removeTags: ["Lead"],
      };
      expect(contactsBulkTagBodySchema.parse(valid)).toEqual(valid);
    });

    it("rejects payload with empty ids array", () => {
      expect(() =>
        contactsBulkTagBodySchema.parse({
          ids: [],
          addTags: ["VIP"],
        }),
      ).toThrow();
    });

    it("rejects payload with neither addTags nor removeTags", () => {
      expect(() =>
        contactsBulkTagBodySchema.parse({
          ids: ["contact-1"],
        }),
      ).toThrow();
    });

    it("rejects unexpected properties (strict mode)", () => {
      expect(() =>
        contactsBulkTagBodySchema.parse({
          ids: ["contact-1"],
          addTags: ["VIP"],
          unexpectedField: true,
        }),
      ).toThrow();
    });
  });

  describe("CONTACT_ACTIVITY_TYPES", () => {
    it("contains all expected activity categories", () => {
      expect(CONTACT_ACTIVITY_TYPES).toEqual([
        "note",
        "stage_change",
        "whatsapp",
        "email",
        "system",
        "task",
        "call",
      ]);
    });
  });
});
