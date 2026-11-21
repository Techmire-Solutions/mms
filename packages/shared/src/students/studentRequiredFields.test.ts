import { describe, expect, it } from "vitest";
import type { FieldDefinition } from "../contacts/contactTypes.js";
import { normalizeStudentsSettings } from "./studentSettingsUtils.js";
import { buildDynamicStudentSchema } from "./studentValidation.js";
import {
  STUDENT_RECOMMENDED_REQUIRED_FIELD_KEYS,
  applyRecommendedStudentRequiredFields,
  applyStudentRequiredFieldKeys,
  listStudentRequirableFields,
  resolveStudentRequiredFieldPreset,
  setStudentFieldRequired,
} from "./studentRequiredFields.js";

function seedFields(): Record<string, FieldDefinition[]> {
  return normalizeStudentsSettings(null).fields as Record<string, FieldDefinition[]>;
}

function withCustomField(
  fields: Record<string, FieldDefinition[]>,
  overrides: Partial<FieldDefinition> = {},
): Record<string, FieldDefinition[]> {
  return {
    ...fields,
    basic: [
      ...fields.basic,
      {
        key: "bFormNumber",
        label: "B-Form Number",
        type: "text",
        enabled: true,
        required: false,
        order: fields.basic.length,
        ...overrides,
      },
    ],
  };
}

function requiredOf(fields: Record<string, FieldDefinition[]>, key: string): boolean | undefined {
  return Object.values(fields)
    .flat()
    .find((field) => field.key === key)?.required;
}

describe("listStudentRequirableFields", () => {
  it("lists enabled seed fields with the contact link locked and skips non-enforceable ones", () => {
    const rows = listStudentRequirableFields(seedFields());
    const keys = rows.map((row) => row.key);
    expect(keys).toEqual(["contactId", "gender", "dob", "grNumber", "status", "notes"]);
    expect(rows.find((row) => row.key === "contactId")).toMatchObject({
      locked: true,
      required: true,
    });
    expect(rows.find((row) => row.key === "dob")).toMatchObject({
      tabKey: "basic",
      locked: false,
      recommended: true,
      isCustom: false,
    });
    expect(keys).not.toContain("contactRelationships");
    expect(keys).not.toContain("registeredDate");
  });

  it("includes enabled custom fields and omits disabled ones", () => {
    const fields = withCustomField(seedFields());
    fields.basic.push({
      key: "hiddenCustom",
      label: "Hidden",
      type: "text",
      enabled: false,
      order: 99,
    });
    const custom = listStudentRequirableFields(fields).filter((row) => row.isCustom);
    expect(custom.map((row) => row.key)).toEqual(["bFormNumber"]);
    expect(custom[0]).toMatchObject({ recommended: false, required: false, locked: false });
  });
});

describe("setStudentFieldRequired / applyStudentRequiredFieldKeys", () => {
  it("toggles one field without mutating the input", () => {
    const fields = seedFields();
    const next = setStudentFieldRequired(fields, "dob", false);
    expect(requiredOf(next, "dob")).toBe(false);
    expect(requiredOf(fields, "dob")).toBe(true);
  });

  it("never makes the contact link optional", () => {
    const next = setStudentFieldRequired(seedFields(), "contactId", false);
    expect(requiredOf(next, "contactId")).toBe(true);
    const viaKeys = applyStudentRequiredFieldKeys(seedFields(), []);
    expect(requiredOf(viaKeys, "contactId")).toBe(true);
  });

  it("leaves non-requirable fields untouched", () => {
    const fields = seedFields();
    const next = applyStudentRequiredFieldKeys(fields, ["registeredDate"]);
    expect(requiredOf(next, "registeredDate")).toBe(requiredOf(fields, "registeredDate"));
    expect(requiredOf(next, "contactRelationships")).toBe(false);
  });

  it("marks custom fields required by key", () => {
    const next = applyStudentRequiredFieldKeys(withCustomField(seedFields()), ["bFormNumber"]);
    expect(requiredOf(next, "bFormNumber")).toBe(true);
    expect(requiredOf(next, "dob")).toBe(false);
  });
});

describe("recommended preset", () => {
  it("requires the enrollment-critical fields and makes the rest optional", () => {
    const fields = applyStudentRequiredFieldKeys(withCustomField(seedFields()), [
      "notes",
      "bFormNumber",
    ]);
    const next = applyRecommendedStudentRequiredFields(fields);
    for (const key of STUDENT_RECOMMENDED_REQUIRED_FIELD_KEYS) {
      expect(requiredOf(next, key)).toBe(true);
    }
    expect(requiredOf(next, "notes")).toBe(false);
    expect(requiredOf(next, "bFormNumber")).toBe(false);
    expect(resolveStudentRequiredFieldPreset(next)).toBe("recommended");
  });

  it("detects a custom selection", () => {
    const next = setStudentFieldRequired(seedFields(), "dob", false);
    expect(resolveStudentRequiredFieldPreset(next)).toBe("custom");
  });
});

describe("required flags drive the student blueprint", () => {
  const baseDraft = { contactId: "c1", grNumber: "GR-1", status: "Active", gender: "Male" };

  function parse(fields: Record<string, FieldDefinition[]>, draft: Record<string, unknown>) {
    const settings = normalizeStudentsSettings({ fields, version: 5 });
    const schema = buildDynamicStudentSchema(
      settings,
      new Set(["basic", "registration"]),
      new Set(),
      settings.fields as Record<string, FieldDefinition[]>,
    );
    return schema.safeParse(draft);
  }

  it("rejects a missing date of birth when DOB is required", () => {
    const fields = setStudentFieldRequired(seedFields(), "dob", true);
    const result = parse(fields, { ...baseDraft, dob: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path[0] === "dob")).toBe(true);
  });

  it("accepts a missing date of birth when DOB is optional", () => {
    const fields = setStudentFieldRequired(seedFields(), "dob", false);
    const result = parse(fields, { ...baseDraft, dob: "" });
    expect(result.error?.issues.filter((issue) => issue.path[0] === "dob") ?? []).toEqual([]);
  });

  it("enforces a required custom field", () => {
    const fields = applyStudentRequiredFieldKeys(withCustomField(seedFields()), [
      ...STUDENT_RECOMMENDED_REQUIRED_FIELD_KEYS,
      "bFormNumber",
    ]);
    const result = parse(fields, { ...baseDraft, dob: "2015-01-01" });
    expect(result.error?.issues.some((issue) => issue.path[0] === "bFormNumber")).toBe(true);
  });
});

describe("required-field save body", () => {
  it("given a toggled registry, should pass the strict field-config PUT DTO", async () => {
    // Arrange
    const { stripStudentFieldConfigForPersist, studentFieldConfigPutBodySchema } =
      await import("./studentSetupConfigTypes.js");
    const settings = normalizeStudentsSettings(null);
    const fields = setStudentFieldRequired(
      settings.fields as Record<string, FieldDefinition[]>,
      "notes",
      true,
    );

    // Act
    const body = stripStudentFieldConfigForPersist({ ...settings, fields });
    const parsed = studentFieldConfigPutBodySchema.safeParse(body);

    // Assert
    expect(parsed.success).toBe(true);
  });
});
