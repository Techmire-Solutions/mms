import { describe, expect, it } from "vitest";
import {
  normalizeStoredStudent,
  stripStudentClientSoftDeleteFields,
  hydrateStudentFromContacts,
  formatStudentNameWithParents,
} from "../students/studentUtils.js";
import { studentRecordSchema } from "../students/studentsModuleManifest.js";
import type { Student } from "../students/studentTypes.js";
import type { Contact } from "../contacts/contactTypes.js";

describe("studentUtils", () => {
  describe("stripStudentClientSoftDeleteFields", () => {
    it("strips client soft-delete fields while preserving core student fields", () => {
      const input = {
        id: "student-1",
        contactId: "contact-100",
        grNumber: "GR-001",
        status: "active",
        deleted: true,
        deletedAt: "2026-01-01T00:00:00.000Z",
        deletedBy: "u-admin",
        deletionReason: "Archived",
      };

      const stripped = stripStudentClientSoftDeleteFields(input);
      expect(stripped.id).toBe("student-1");
      expect(stripped.contactId).toBe("contact-100");
      expect(stripped.grNumber).toBe("GR-001");
      expect(stripped.status).toBe("active");
      expect("deleted" in stripped).toBe(false);
      expect("deletedAt" in stripped).toBe(false);
      expect("deletedBy" in stripped).toBe(false);
      expect("deletionReason" in stripped).toBe(false);
    });
  });

  describe("normalizeStoredStudent", () => {
    it("strips contact-owned display fields and guardian link fields from student record", () => {
      const input = {
        id: "student-1",
        contactId: "contact-100",
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "+923001234567",
        fatherName: "John Doe",
        fatherContactId: "contact-200",
        motherContactId: "contact-201",
        guardianContactId: "contact-202",
        motherName: "Jane Sr",
        guardianName: "Uncle",
        grNumber: "GR-001",
        status: "active",
      };

      const normalized = normalizeStoredStudent(input);
      expect(normalized.id).toBe("student-1");
      expect(normalized.contactId).toBe("contact-100");
      expect(normalized.grNumber).toBe("GR-001");
      expect(normalized.status).toBe("active");
      expect("name" in normalized).toBe(false);
      expect("email" in normalized).toBe(false);
      expect("phone" in normalized).toBe(false);
      expect("fatherName" in normalized).toBe(false);
      expect("fatherContactId" in normalized).toBe(false);
      expect("motherContactId" in normalized).toBe(false);
      expect("guardianContactId" in normalized).toBe(false);
      expect("motherName" in normalized).toBe(false);
      expect("guardianName" in normalized).toBe(false);
    });

    it("strips client soft-delete metadata from student record", () => {
      const input = {
        id: "student-2",
        contactId: "contact-100",
        grNumber: "GR-002",
        status: "active",
        deletedAt: "2026-01-01T00:00:00.000Z",
        deleted: true,
        deletedBy: "u-evil",
        deletionReason: "should not persist",
      };

      const normalized = normalizeStoredStudent(input);
      expect(normalized.id).toBe("student-2");
      expect("deletedAt" in normalized).toBe(false);
      expect("deleted" in normalized).toBe(false);
      expect("deletedBy" in normalized).toBe(false);
      expect("deletionReason" in normalized).toBe(false);
    });
  });

  describe("studentRecordSchema", () => {
    it("drops client soft-delete keys on parse while keeping Setup customs", () => {
      const parsed = studentRecordSchema.parse({
        id: "student-3",
        contactId: "contact-100",
        grNumber: "GR-003",
        status: "active",
        deletedAt: "2026-01-01T00:00:00.000Z",
        deleted: true,
        deletedBy: "u-evil",
        deletionReason: "client wipe",
        customHouse: "Green",
      }) as Record<string, unknown>;

      expect(parsed.id).toBe("student-3");
      expect(parsed.grNumber).toBe("GR-003");
      expect(parsed.customHouse).toBe("Green");
      expect(parsed.deletedAt).toBeUndefined();
      expect(parsed.deleted).toBeUndefined();
      expect(parsed.deletedBy).toBeUndefined();
      expect(parsed.deletionReason).toBeUndefined();
    });
  });

  describe("hydrateStudentFromContacts", () => {
    const contacts: Contact[] = [
      {
        id: "c-1",
        firstName: "Fatima",
        lastName: "Ahmed",
        name: "Fatima Ahmed",
        emails: [{ label: "Personal", address: "fatima@example.com" }],
        phones: [{ label: "Mobile", number: "3001112233", countryCode: "+92" }],
        relationshipContacts: [
          { contactId: "c-father", relationship: "Parent", name: "Tariq Ahmed" },
          { contactId: "c-mother", relationship: "Parent", name: "Zainab Bibi" },
        ],
      },
      {
        id: "c-father",
        firstName: "Tariq",
        lastName: "Ahmed",
        name: "Tariq Ahmed",
        gender: "male",
        phones: [{ label: "Mobile", number: "3009998877", countryCode: "+92" }],
      },
      {
        id: "c-mother",
        firstName: "Zainab",
        lastName: "Bibi",
        name: "Zainab Bibi",
        gender: "female",
      },
    ];

    it("hydrates student profile and both parents from contact relationships", () => {
      const rawStudent: Student = {
        id: "st-1",
        contactId: "c-1",
        grNumber: "GR-101",
        status: "active",
      };

      const hydrated = hydrateStudentFromContacts(rawStudent, contacts);
      expect(hydrated.name).toBe("Fatima Ahmed");
      expect(hydrated.email).toBe("fatima@example.com");
      expect(hydrated.phone).toBe("3001112233");
      expect(hydrated.fatherContactId).toBe("c-father");
      expect(hydrated.fatherName).toBe("Tariq Ahmed");
      expect(hydrated.motherContactId).toBe("c-mother");
      expect(hydrated.motherName).toBe("Zainab Bibi");
    });

    it("falls back to legacy student parent contact ids when relationships omit them", () => {
      const rawStudent: Student = {
        id: "st-1b",
        contactId: "c-1",
        fatherContactId: "c-father",
        motherContactId: "c-mother",
        grNumber: "GR-101b",
        status: "active",
      };
      const primaryWithoutParents: Contact = {
        ...contacts[0]!,
        relationshipContacts: [],
      };

      const hydrated = hydrateStudentFromContacts(rawStudent, [
        primaryWithoutParents,
        contacts[1]!,
        contacts[2]!,
      ]);
      expect(hydrated.fatherContactId).toBe("c-father");
      expect(hydrated.fatherName).toBe("Tariq Ahmed");
      expect(hydrated.motherContactId).toBe("c-mother");
      expect(hydrated.motherName).toBe("Zainab Bibi");
    });

    it("handles student without linked parent contacts gracefully", () => {
      const rawStudent: Student = {
        id: "st-2",
        contactId: "c-1",
        grNumber: "GR-102",
        status: "active",
      };
      const primaryAlone: Contact = {
        id: "c-1",
        firstName: "Fatima",
        lastName: "Ahmed",
        name: "Fatima Ahmed",
        emails: [{ label: "Personal", address: "fatima@example.com" }],
        phones: [{ label: "Mobile", number: "3001112233", countryCode: "+92" }],
      };

      const hydrated = hydrateStudentFromContacts(rawStudent, [primaryAlone]);
      expect(hydrated.name).toBe("Fatima Ahmed");
      expect(hydrated.fatherName).toBeUndefined();
      expect(hydrated.motherName).toBeUndefined();
    });
  });

  describe("formatStudentNameWithParents", () => {
    it("formats student name with both father and mother", () => {
      const formatted = formatStudentNameWithParents({
        name: "M Hussain",
        fatherName: "Ali",
        motherName: "Kaneez Fatima",
      });
      expect(formatted).toBe("M Hussain (Father: Ali, Mother: Kaneez Fatima)");
    });

    it("formats student name with father only", () => {
      const formatted = formatStudentNameWithParents({
        name: "M Hussain",
        fatherName: "Ali",
      });
      expect(formatted).toBe("M Hussain (Father: Ali)");
    });

    it("formats student name with mother only", () => {
      const formatted = formatStudentNameWithParents({
        name: "M Hussain",
        motherName: "Kaneez Fatima",
      });
      expect(formatted).toBe("M Hussain (Mother: Kaneez Fatima)");
    });

    it("formats student name with guardian when neither father nor mother is set", () => {
      const formatted = formatStudentNameWithParents({
        name: "M Hussain",
        guardianName: "Uncle Sam",
      });
      expect(formatted).toBe("M Hussain (Guardian: Uncle Sam)");
    });

    it("trims whitespace around names properly", () => {
      const formatted = formatStudentNameWithParents({
        name: "  M Hussain  ",
        fatherName: "  Ali  ",
        motherName: "  Kaneez Fatima  ",
      });
      expect(formatted).toBe("M Hussain (Father: Ali, Mother: Kaneez Fatima)");
    });

    it("returns student name alone when no parentage or guardian is present", () => {
      const formatted = formatStudentNameWithParents({
        name: "M Hussain",
      });
      expect(formatted).toBe("M Hussain");
    });

    it("uses custom localized labels and separator when provided", () => {
      const formatted = formatStudentNameWithParents(
        {
          name: "M Hussain",
          fatherName: "Ali",
          motherName: "Kaneez Fatima",
        },
        {
          father: "والد",
          mother: "والدہ",
          separator: "، ",
        },
      );
      expect(formatted).toBe("M Hussain (والد: Ali، والدہ: Kaneez Fatima)");
    });

    it("handles null and undefined input gracefully without throwing", () => {
      expect(formatStudentNameWithParents(null)).toBe("");
      expect(formatStudentNameWithParents(undefined)).toBe("");
      expect(formatStudentNameWithParents({})).toBe("");
    });
  });
});
