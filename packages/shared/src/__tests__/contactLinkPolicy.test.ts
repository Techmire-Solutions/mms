import { describe, expect, it } from "vitest";
import {
  stripRecordFields,
  normalizeContactLinkedRecord,
  normalizeParentContactLinks,
  hydrateContactProfile,
  hydrateParentContactNames,
  resolveEntityName,
  createNamedEntityLookupMap,
  contactDisplayName,
  composeContactName,
} from "../contacts/contactLinkPolicy.js";

describe("contactLinkPolicy", () => {
  describe("stripRecordFields", () => {
    it("removes specified profile fields from an object", () => {
      const input = { id: 1, name: "John", phone: "+123" };
      const stripped = stripRecordFields(input, ["name", "phone"]);
      expect(stripped.id).toBe(1);
      expect(stripped).not.toHaveProperty("name");
      expect(stripped).not.toHaveProperty("phone");
    });
  });

  describe("normalizeContactLinkedRecord", () => {
    it("strips profile fields when contactId is present", () => {
      const record = { id: "s1", contactId: "c1", name: "Jane", phone: "+123" };
      const normalized = normalizeContactLinkedRecord(record);
      expect(normalized.id).toBe("s1");
      expect(normalized.contactId).toBe("c1");
      expect(normalized).not.toHaveProperty("name");
      expect(normalized).not.toHaveProperty("phone");
    });

    it("retains fields when contactId is missing", () => {
      const record = { id: "s1", name: "Jane", phone: "+123" };
      const normalized = normalizeContactLinkedRecord(record);
      expect(normalized.name).toBe("Jane");
    });
  });

  describe("normalizeParentContactLinks", () => {
    it("strips denormalized parent names when parent contact IDs exist", () => {
      const record = {
        id: "st1",
        fatherContactId: "c_father",
        fatherName: "Dad",
        motherContactId: "c_mother",
        motherName: "Mom",
      };
      const normalized = normalizeParentContactLinks(record);
      expect(normalized).not.toHaveProperty("fatherName");
      expect(normalized).not.toHaveProperty("motherName");
    });
  });

  describe("hydrateContactProfile & hydrateParentContactNames", () => {
    const contacts = [
      { id: "c1", name: "Jane Doe", gender: "female", phones: [{ number: "+123456789" }] },
      { id: "c_father", name: "John Doe Sr." },
    ];

    it("hydrates contact profile fields from contacts array", () => {
      const record: Record<string, unknown> = { id: "s1", contactId: "c1" };
      const hydrated = hydrateContactProfile(record, contacts);
      expect(hydrated.name).toBe("Jane Doe");
      expect(hydrated.gender).toBe("female");
      expect(hydrated.phone).toBe("+123456789");
    });

    it("does not overwrite stored name with empty contact.name", () => {
      const record: Record<string, unknown> = { id: "s1", contactId: "c2", name: "Kept Name" };
      const hydrated = hydrateContactProfile(record, [
        { id: "c2", name: "", firstName: "", lastName: "" },
      ]);
      expect(hydrated.name).toBe("Kept Name");
    });

    it("composes name from firstName/lastName when name is empty", () => {
      const record: Record<string, unknown> = { id: "s1", contactId: "c3" };
      const hydrated = hydrateContactProfile(record, [
        { id: "c3", firstName: "John", lastName: "Doe", emails: [{ address: "j@example.com" }] },
      ]);
      expect(hydrated.name).toBe("John Doe");
      expect(hydrated.email).toBe("j@example.com");
    });

    it("hydrates parent names from parent contact IDs", () => {
      const record: Record<string, unknown> = { id: "st1", fatherContactId: "c_father" };
      const hydrated = hydrateParentContactNames(record, contacts);
      expect(hydrated.fatherName).toBe("John Doe Sr.");
    });
  });

  describe("composeContactName", () => {
    it("joins first and last name", () => {
      expect(composeContactName("John", "Doe")).toBe("John Doe");
    });

    it("handles a missing last name", () => {
      expect(composeContactName("Jane")).toBe("Jane");
    });

    it("handles a missing first name", () => {
      expect(composeContactName(undefined, "Doe")).toBe("Doe");
    });

    it("returns empty when both parts are missing", () => {
      expect(composeContactName()).toBe("");
      expect(composeContactName("", "")).toBe("");
    });

    it("trims whitespace and drops empty parts", () => {
      expect(composeContactName("  John  ", "  Doe ")).toBe("John Doe");
      expect(composeContactName("  John  ", "")).toBe("John");
    });
  });

  describe("contactDisplayName", () => {
    it("prefers name, then composes firstName and lastName", () => {
      expect(
        contactDisplayName({ id: "1", name: "Full Name", firstName: "A", lastName: "B" }),
      ).toBe("Full Name");
      expect(contactDisplayName({ id: "1", firstName: "John", lastName: "Doe" })).toBe("John Doe");
      expect(contactDisplayName({ id: "1", name: "  ", firstName: "Jane" })).toBe("Jane");
    });
  });

  describe("resolveEntityName", () => {
    it("resolves name by entity ID and returns empty string if not found", () => {
      const entities = [{ id: "e1", name: "Entity One" }];
      expect(resolveEntityName("e1", entities)).toBe("Entity One");
      expect(resolveEntityName("e2", entities)).toBe("");
      expect(resolveEntityName(null, entities)).toBe("");
    });
  });

  describe("createNamedEntityLookupMap", () => {
    it("indexes entities by string ID into Map for O(1) resolution", () => {
      const entities = [
        { id: "e1", name: "Entity One" },
        { id: 2, name: "Entity Two" },
      ];
      const map = createNamedEntityLookupMap(entities);
      expect(map.get("e1")?.name).toBe("Entity One");
      expect(map.get("2")?.name).toBe("Entity Two");
      expect(resolveEntityName("e1", map)).toBe("Entity One");
      expect(resolveEntityName(2, map)).toBe("Entity Two");
    });
  });
});
