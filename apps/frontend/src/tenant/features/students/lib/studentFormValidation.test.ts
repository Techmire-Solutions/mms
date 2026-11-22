import { describe, expect, it } from "vitest";
import {
  INITIAL_STUDENT_FIELD_SEED,
  type Contact,
  type FieldDefinition,
  type StudentsSettings,
} from "@mms/shared";
import { getInitialStudentDraft } from "./studentFormDraft";
import { validateStudentDraft } from "../hooks/studentFormValidation";

const linkedContact: Contact = {
  id: "c-1",
  name: "Aisha",
  firstName: "Aisha",
  gender: "female",
  dob: "2010-01-01",
  line1: "12 Madrasa Road",
  education: [{ institution: "Al-Noor Madrasa" }],
  relationshipContacts: [
    { contactId: "f-1", name: "Father", gender: "male", relationship: "Parent" },
    { contactId: "m-1", name: "Mother", gender: "female", relationship: "Parent" },
    { contactId: "g-1", name: "Uncle", gender: "male", relationship: "Guardian" },
  ],
};

function settings(overrides: Partial<StudentsSettings> = {}): StudentsSettings {
  return {
    fields: INITIAL_STUDENT_FIELD_SEED,
    enabledTabs: ["basic", "registration"],
    requiredTabs: ["basic", "registration"],
    version: 1,
    autoGenerateId: false,
    ...overrides,
  } as StudentsSettings;
}

function validDraft(): Record<string, unknown> {
  return {
    contactId: "c-1",
    grNumber: "GR-1",
    status: "active",
    registeredDate: "2026-01-01",
  };
}

describe("student form validation", () => {
  it("strips the nested customFields read projection from the editable draft", () => {
    const draft = getInitialStudentDraft({
      student: {
        id: "st-1",
        contactId: "c-1",
        grNumber: "GR-1",
        status: "active",
        customFields: { favoriteColor: "green" },
        rollNumber: "legacy roll",
      },
      fields: INITIAL_STUDENT_FIELD_SEED,
    });

    expect(draft).not.toHaveProperty("customFields");
    expect(draft).not.toHaveProperty("rollNumber");
    expect(draft.grNumber).toBe("GR-1");
  });

  it("keeps an enabled Setup custom field value on the draft", () => {
    const fields: Record<string, FieldDefinition[]> = {
      ...INITIAL_STUDENT_FIELD_SEED,
      basic: [
        ...(INITIAL_STUDENT_FIELD_SEED.basic ?? []),
        {
          key: "favoriteColor",
          label: "Favorite color",
          type: "text",
          enabled: true,
          order: 99,
        },
      ],
    };

    const draft = getInitialStudentDraft({
      student: { id: "st-1", contactId: "c-1", favoriteColor: "green" },
      fields,
    });

    expect(draft.favoriteColor).toBe("green");
  });

  it("accepts an unchanged hydrated record with customFields", () => {
    const draft = getInitialStudentDraft({
      student: {
        ...validDraft(),
        id: "st-1",
        customFields: { favoriteColor: "green" },
      },
      fields: INITIAL_STUDENT_FIELD_SEED,
    });

    expect(
      validateStudentDraft(draft, {
        settings: settings(),
        enabledTabs: new Set(["basic", "registration"]),
        requiredTabs: new Set(["basic", "registration"]),
        fields: INITIAL_STUDENT_FIELD_SEED,
        language: "en",
        linkedGenderRaw: "female",
        linkedDob: "2010-01-01",
        linkedContact,
      }),
    ).toBeNull();
  });

  it("reports the wire-DTO bound on an over-long GR number", () => {
    const errors = validateStudentDraft(
      { ...validDraft(), grNumber: "G".repeat(101) },
      {
        settings: settings(),
        enabledTabs: new Set(["basic", "registration"]),
        requiredTabs: new Set(["basic", "registration"]),
        fields: INITIAL_STUDENT_FIELD_SEED,
        language: "en",
        linkedGenderRaw: "female",
        linkedDob: "2010-01-01",
        linkedContact,
      },
    );

    expect(errors?.some((issue) => issue.fieldId === "grNumber")).toBe(true);
  });

  it("reports the contact-profile gaps when the linked contact is incomplete", () => {
    const errors = validateStudentDraft(
      { ...validDraft() },
      {
        settings: settings(),
        enabledTabs: new Set(["basic", "registration"]),
        requiredTabs: new Set(["basic", "registration"]),
        fields: INITIAL_STUDENT_FIELD_SEED,
        language: "en",
        linkedGenderRaw: "female",
        linkedDob: "2010-01-01",
        linkedContact: {
          id: "c-9",
          name: "Bare",
          firstName: "Bare",
          gender: "female",
          dob: "2010-01-01",
        },
      },
    );

    const fieldIds = (errors ?? []).map((issue) => issue.fieldId);
    expect(fieldIds).toEqual(
      expect.arrayContaining(["contactRelationships", "address", "education"]),
    );
  });

  it("rejects unknown read-only keys before the blueprint layer", () => {
    const errors = validateStudentDraft(
      { ...validDraft(), address: "not a student write field" },
      {
        settings: settings(),
        enabledTabs: new Set(["basic", "registration"]),
        requiredTabs: new Set(["basic", "registration"]),
        fields: INITIAL_STUDENT_FIELD_SEED,
        language: "en",
        linkedGenderRaw: "female",
        linkedDob: "2010-01-01",
        linkedContact,
      },
    );

    expect(errors?.some((issue) => issue.fieldId === "address")).toBe(true);
  });
});
