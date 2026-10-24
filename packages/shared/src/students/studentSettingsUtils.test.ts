import { describe, expect, it } from "vitest";
import {
  DEFAULT_STUDENTS_SETTINGS,
  type FieldDefinition,
  normalizeStudentsSettings,
} from "../index.js";

describe("normalizeStudentsSettings", () => {
  it("migrates legacy flat student fields into Identity + Registration (v4)", () => {
    const settings = normalizeStudentsSettings({
      ...DEFAULT_STUDENTS_SETTINGS,
      fields: {
        gender: { enabled: true, required: false },
        dob: { enabled: true, required: true },
        fatherLink: { enabled: false, required: false },
      },
    });

    expect(settings.version).toBe(5);
    expect(settings.enabledTabs).toEqual(["registration"]);
    expect(Array.isArray(settings.fields?.basic)).toBe(true);
    expect(Array.isArray(settings.fields?.registration)).toBe(true);
    expect(settings.fields?.guardian).toBeUndefined();
    expect(settings.fields?.academic).toBeUndefined();
    const fields = settings.fields as Record<string, FieldDefinition[]>;
    expect(fields.basic.find((field) => field.key === "gender")?.required).toBe(false);
    expect(fields.basic.find((field) => field.key === "fatherLink")).toBeUndefined();
    expect(fields.basic.find((field) => field.key === "contactRelationships")?.enabled).toBe(false);
    expect(fields.basic.find((field) => field.key === "contactId")?.key).toBe("contactId");
    expect(fields.registration.map((field) => field.key)).toEqual(
      expect.arrayContaining(["grNumber", "status", "registeredDate", "notes"]),
    );
  });

  it("preserves modern tabbed fields even when a stored version is missing", () => {
    const settings = normalizeStudentsSettings({
      ...DEFAULT_STUDENTS_SETTINGS,
      version: undefined,
      fields: {
        basic: [
          {
            key: "studentCode",
            label: "Student code",
            type: "text",
            enabled: true,
            required: true,
            order: 0,
          },
        ],
      },
    });

    const fields = settings.fields as Record<string, FieldDefinition[]>;
    expect(settings.version).toBe(5);
    expect(fields.basic.map((field) => field.key)).toContain("studentCode");
    expect(fields.basic.find((field) => field.key === "studentCode")?.required).toBe(true);
    expect(fields.basic.find((field) => field.key === "contactRelationships")?.key).toBe(
      "contactRelationships",
    );
    expect(fields.basic.find((field) => field.key === "contactId")?.key).toBe("contactId");
    expect(fields.registration.find((field) => field.key === "grNumber")?.key).toBe("grNumber");
    expect(fields.registration.find((field) => field.key === "status")?.key).toBe("status");
    expect(fields.registration.find((field) => field.key === "notes")?.key).toBe("notes");
  });

  it("merges guardian into basic and replaces triad with contactRelationships at v4", () => {
    const settings = normalizeStudentsSettings({
      ...DEFAULT_STUDENTS_SETTINGS,
      version: 2,
      enabledTabs: ["guardian", "academic"],
      formTabs: [
        { key: "basic", label: "Identity", enabled: true, order: 0, isSystem: true },
        { key: "guardian", label: "Guardians", enabled: true, order: 1, isSystem: true },
        { key: "academic", label: "Enrollment", enabled: true, order: 2, isSystem: true },
      ],
      fields: {
        basic: [
          {
            key: "gender",
            label: "Gender",
            type: "select",
            enabled: true,
            required: true,
            order: 0,
          },
          {
            key: "house",
            label: "House",
            type: "text",
            enabled: true,
            required: false,
            order: 10,
          },
        ],
        guardian: [
          {
            key: "fatherLink",
            label: "Father",
            type: "text",
            enabled: true,
            required: false,
            order: 0,
          },
          {
            key: "emergencyNote",
            label: "Emergency note",
            type: "text",
            enabled: true,
            required: false,
            order: 1,
          },
        ],
        academic: [
          {
            key: "registeredDate",
            label: "Registration Date",
            type: "date",
            enabled: true,
            required: true,
            order: 0,
          },
          {
            key: "scholarshipNote",
            label: "Scholarship",
            type: "text",
            enabled: true,
            required: false,
            order: 1,
          },
        ],
      },
    });

    expect(settings.version).toBe(5);
    expect(settings.enabledTabs).toEqual(["registration"]);
    expect(settings.fields?.guardian).toBeUndefined();
    expect(settings.fields?.academic).toBeUndefined();

    const fields = settings.fields as Record<string, FieldDefinition[]>;
    expect(fields.basic.map((field) => field.key)).toEqual([
      "contactId",
      "gender",
      "dob",
      "house",
      "emergencyNote",
      "contactRelationships",
    ]);
    expect(fields.basic.find((field) => field.key === "contactRelationships")?.enabled).toBe(true);
    expect(fields.registration.map((field) => field.key)).toEqual([
      "grNumber",
      "status",
      "registeredDate",
      "notes",
      "scholarshipNote",
    ]);
    expect(settings.formTabs?.map((tab) => tab.key)).toEqual(["basic", "registration"]);
  });

  it("injects missing form seed fields on v4 configs (v5)", () => {
    const settings = normalizeStudentsSettings({
      ...DEFAULT_STUDENTS_SETTINGS,
      version: 4,
      fields: {
        basic: [
          {
            key: "gender",
            label: "Gender",
            type: "select",
            enabled: true,
            required: true,
            order: 0,
          },
          {
            key: "dob",
            label: "Date of Birth",
            type: "date",
            enabled: true,
            required: true,
            order: 1,
          },
          {
            key: "contactRelationships",
            label: "Relationships",
            type: "text",
            enabled: true,
            required: false,
            order: 2,
          },
        ],
        registration: [
          {
            key: "registeredDate",
            label: "Registration Date",
            type: "date",
            enabled: true,
            required: true,
            order: 0,
          },
        ],
      },
    });

    expect(settings.version).toBe(5);
    const fields = settings.fields as Record<string, FieldDefinition[]>;
    expect(fields.basic.map((field) => field.key)).toEqual([
      "contactId",
      "gender",
      "dob",
      "contactRelationships",
    ]);
    expect(fields.registration.map((field) => field.key)).toEqual([
      "grNumber",
      "status",
      "registeredDate",
      "notes",
    ]);
    expect(fields.basic.find((field) => field.key === "contactId")?.enabled).toBe(true);
    expect(fields.basic.find((field) => field.key === "contactId")?.required).toBe(true);
    expect(fields.basic.find((field) => field.key === "gender")?.labelKey).toBe("students.gender");
  });

  it("strips retired preference keys from legacy students_settings", () => {
    const settings = normalizeStudentsSettings({
      ...DEFAULT_STUDENTS_SETTINGS,
      version: 5,
      requireGuardian: true,
      requirePhoto: true,
      defaultViewLayout: "cards",
      idPrefix: "STU",
      defaultGender: "Male",
      minAge: "5",
      maxAge: "25",
      allowSiblingDiscount: true,
    } as typeof DEFAULT_STUDENTS_SETTINGS & Record<string, unknown>);

    const legacy = settings as unknown as Record<string, unknown>;
    expect(legacy.requireGuardian).toBeUndefined();
    expect(legacy.requirePhoto).toBeUndefined();
    expect(legacy.defaultViewLayout).toBeUndefined();
    expect(legacy.idPrefix).toBeUndefined();
    expect(legacy.defaultGender).toBeUndefined();
    expect(legacy.minAge).toBeUndefined();
    expect(legacy.maxAge).toBeUndefined();
    expect(legacy.allowSiblingDiscount).toBeUndefined();
  });

  it("falls back to default seed fields when raw.fields is an empty object", () => {
    const settings = normalizeStudentsSettings({ fields: {} });
    expect(typeof settings.fields).toBe("object");
    expect(Object.keys(settings.fields as Record<string, unknown>).length).toBeGreaterThan(0);
    expect(Array.isArray((settings.fields as any).basic)).toBe(true);
    expect((settings.fields as any).basic.length).toBeGreaterThan(0);
  });
});
