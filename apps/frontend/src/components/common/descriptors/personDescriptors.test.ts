import { describe, it, expect } from "vitest";
import { contactsEntityDescriptor, studentsEntityDescriptor } from "./personDescriptors";

describe("personDescriptors", () => {
  describe("contactsEntityDescriptor", () => {
    it("should be defined with correct entityType", () => {
      expect(contactsEntityDescriptor.entityType).toBe("contacts");
      expect(contactsEntityDescriptor.singularLabel).toBe("Contact");
    });

    it("should have unique field keys", () => {
      const keys = contactsEntityDescriptor.fields.map((f) => f.key);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);
    });

    it("should have a primary card slot", () => {
      const primaryFields = contactsEntityDescriptor.fields.filter((f) => f.cardSlot === "primary");
      expect(primaryFields.length).toBeGreaterThan(0);
    });
  });

  describe("studentsEntityDescriptor", () => {
    it("should be defined with correct entityType", () => {
      expect(studentsEntityDescriptor.entityType).toBe("students");
      expect(studentsEntityDescriptor.pluralLabel).toBe("Students");
    });

    it("should have unique field keys", () => {
      const keys = studentsEntityDescriptor.fields.map((f) => f.key);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);
    });

    it("should map gender badges correctly", () => {
      const genderField = studentsEntityDescriptor.fields.find((f) => f.key === "gender");
      expect(genderField).toBeDefined();
      expect(genderField?.badgeVariantMap).toBeDefined();
      expect(genderField?.badgeVariantMap?.male).toBeDefined();
    });
  });
});
