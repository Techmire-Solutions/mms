import { describe, expect, it } from "vitest";
import {
  collectContactRelationshipLinks,
  deriveStudentGuardiansFromContact,
  hasResponsibleAdultLink,
  listStudentContactRelationships,
  pickPrimaryResponsibleAdult,
  primaryResponsibleAdultDisplayName,
  resolveStudentGuardianLinks,
  STUDENT_GUARDIAN_RELATIONSHIP_LABEL,
  STUDENT_PARENT_RELATIONSHIP_LABEL,
} from "../students/studentGuardianFromContacts.js";

describe("studentGuardianFromContacts", () => {
  describe("constants", () => {
    it("exports standard system-catalog forward labels", () => {
      expect(STUDENT_PARENT_RELATIONSHIP_LABEL).toBe("Parent");
      expect(STUDENT_GUARDIAN_RELATIONSHIP_LABEL).toBe("Guardian");
    });
  });

  describe("collectContactRelationshipLinks", () => {
    it("merges relationshipContacts and legacy relationships, preferring non-inferred", () => {
      const contact = {
        relationshipContacts: [
          {
            contactId: "c-1",
            relationship: "Parent",
            name: "Direct Parent",
            inferred: false,
            gender: "male",
          },
        ],
        relationships: [
          { contactId: "c-1", relationship: "Parent", name: "Inferred Parent", inferred: true },
          { contactId: "c-2", relationship: "Guardian", name: "Legacy Guardian" },
        ],
      };
      const links = collectContactRelationshipLinks(contact);
      expect(links).toHaveLength(2);
      expect(links.find((l) => l.contactId === "c-1")).toMatchObject({
        name: "Direct Parent",
        inferred: false,
        gender: "male",
      });
      expect(links.find((l) => l.contactId === "c-2")).toMatchObject({
        name: "Legacy Guardian",
      });
    });
  });

  describe("listStudentContactRelationships & hasResponsibleAdultLink", () => {
    it("handles null or undefined contact safely", () => {
      expect(listStudentContactRelationships(null)).toEqual([]);
      expect(listStudentContactRelationships(undefined)).toEqual([]);
      expect(hasResponsibleAdultLink(null)).toBe(false);
      expect(hasResponsibleAdultLink(undefined)).toBe(false);
    });

    it("lists only system-catalog relationship labels and captures email/gender", () => {
      const links = listStudentContactRelationships({
        relationshipContacts: [
          {
            contactId: "c-p",
            relationship: "Parent",
            name: "Abu",
            email: "abu@example.com",
            gender: "male",
          },
          { contactId: "c-g", relationship: "Guardian", name: "Uncle" },
          { contactId: "c-w", relationship: "Wife", name: "Spouse" },
          { contactId: "c-x", relationship: "Father", name: "Skip" },
          { contactId: "c-s", relationship: "Sibling", name: "Skip" },
        ],
      });
      expect(links).toEqual([
        {
          contactId: "c-p",
          name: "Abu",
          relationship: "Parent",
          email: "abu@example.com",
          gender: "male",
        },
        { contactId: "c-g", name: "Uncle", relationship: "Guardian" },
        { contactId: "c-w", name: "Spouse", relationship: "Wife" },
      ]);
    });

    it("detects responsible adult links and picks Parent over Guardian", () => {
      const contact = {
        relationshipContacts: [
          { contactId: "c-g", relationship: "Guardian", name: "Uncle" },
          { contactId: "c-p", relationship: "Parent", name: "Abu" },
        ],
      };
      const links = listStudentContactRelationships(contact);
      expect(hasResponsibleAdultLink(contact)).toBe(true);
      expect(pickPrimaryResponsibleAdult(links)?.contactId).toBe("c-p");
      expect(
        hasResponsibleAdultLink({
          relationshipContacts: [{ contactId: "c-w", relationship: "Wife" }],
        }),
      ).toBe(false);
    });
  });

  describe("resolveStudentGuardianLinks", () => {
    it("maps single female parent specifically to mother slots", () => {
      const resolved = resolveStudentGuardianLinks(
        {},
        {
          relationshipContacts: [
            { contactId: "c-m", relationship: "Parent", name: "Mother Only", gender: "female" },
          ],
        },
      );
      expect(resolved.motherContactId).toBe("c-m");
      expect(resolved.motherName).toBe("Mother Only");
      expect(resolved.fatherContactId).toBeUndefined();
      expect(resolved.fatherName).toBeUndefined();
    });

    it("maps 2 parents without explicit gender to 1st father and 2nd mother", () => {
      const resolved = resolveStudentGuardianLinks(
        {},
        {
          relationshipContacts: [
            { contactId: "c-1", relationship: "Parent", name: "First Parent" },
            { contactId: "c-2", relationship: "Parent", name: "Second Parent" },
          ],
        },
      );
      expect(resolved.fatherContactId).toBe("c-1");
      expect(resolved.fatherName).toBe("First Parent");
      expect(resolved.motherContactId).toBe("c-2");
      expect(resolved.motherName).toBe("Second Parent");
    });

    it("resolves mother and father links accurately when explicit genders are specified", () => {
      const resolved = resolveStudentGuardianLinks(
        {},
        {
          relationshipContacts: [
            { contactId: "c-m", relationship: "Parent", name: "Mother Name", gender: "female" },
            { contactId: "c-f", relationship: "Parent", name: "Father Name", gender: "male" },
          ],
        },
      );
      expect(resolved.fatherContactId).toBe("c-f");
      expect(resolved.fatherName).toBe("Father Name");
      expect(resolved.motherContactId).toBe("c-m");
      expect(resolved.motherName).toBe("Mother Name");
    });

    it("prefers contact Parent/Guardian over legacy student fields", () => {
      const resolved = resolveStudentGuardianLinks(
        {
          fatherContactId: "legacy-f",
          fatherName: "Legacy Father",
          guardianContactId: "legacy-g",
        },
        {
          relationshipContacts: [
            { contactId: "rel-p", relationship: "Parent", name: "Rel Parent" },
          ],
        },
      );
      expect(resolved.fatherContactId).toBe("rel-p");
      expect(resolved.fatherName).toBe("Rel Parent");
      expect(resolved.guardianContactId).toBe("legacy-g");
    });

    it("falls back to legacy student fields when contact has no Parent/Guardian", () => {
      const resolved = resolveStudentGuardianLinks(
        {
          guardianContactId: "legacy-g",
          guardianName: "Legacy Guardian",
        },
        { relationshipContacts: [{ contactId: "c-w", relationship: "Wife", name: "Spouse" }] },
      );
      expect(resolved.guardianContactId).toBe("legacy-g");
      expect(resolved.guardianName).toBe("Legacy Guardian");
      expect(resolved.fatherContactId).toBeUndefined();
    });
  });

  describe("primaryResponsibleAdultDisplayName & deriveStudentGuardiansFromContact", () => {
    it("formats primaryResponsibleAdultDisplayName with father, mother, or guardian fallback", () => {
      expect(primaryResponsibleAdultDisplayName({ fatherName: "Abu", motherName: "Ammi" })).toBe(
        "Abu",
      );
      expect(
        primaryResponsibleAdultDisplayName({ motherName: "Ammi", guardianName: "Uncle" }),
      ).toBe("Ammi");
      expect(primaryResponsibleAdultDisplayName({ guardianName: "Uncle" })).toBe("Uncle");
      expect(primaryResponsibleAdultDisplayName({})).toBe("");
    });

    it("maps Parent/Guardian into display slots via deriveStudentGuardiansFromContact", () => {
      const derived = deriveStudentGuardiansFromContact({
        relationshipContacts: [
          { contactId: "c-p", relationship: "Parent", name: "Abu" },
          { contactId: "c-g", relationship: "Guardian", name: "Uncle" },
          { contactId: "c-f", relationship: "Father", name: "Old" },
        ],
      });
      expect(derived).toEqual({
        fatherContactId: "c-p",
        fatherName: "Abu",
        motherContactId: undefined,
        motherName: undefined,
        guardianContactId: "c-g",
        guardianName: "Uncle",
      });
    });
  });
});
