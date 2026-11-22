import { describe, expect, it } from "vitest";
import type { FieldDefinition } from "../contacts/contactTypes.js";
import { normalizeStudentsSettings } from "./studentSettingsUtils.js";
import { buildDynamicStudentSchema } from "./studentValidation.js";
import {
  STUDENT_RECOMMENDED_REQUIRED_FIELD_KEYS,
  listStudentRequirableFields,
  resolveStudentContactProfileGaps,
  resolveStudentContactProfileRequirements,
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
  it("lists only the contact-profile recommendations and skips system/registration rows", () => {
    const rows = listStudentRequirableFields(seedFields());
    const keys = rows.map((row) => row.key);
    expect(keys).toEqual(["gender", "dob", "contactRelationships", "address", "education"]);
    expect(rows.find((row) => row.key === "dob")).toMatchObject({
      tabKey: "basic",
      recommended: true,
      isCustom: false,
    });
    expect(keys).not.toContain("contactId");
    expect(keys).not.toContain("registeredDate");
  });

  it("keeps the contact link out of the requirable list", () => {
    const contactId = listStudentRequirableFields({
      basic: [
        { key: "contactId", label: "Student Contact", type: "text", enabled: true, order: 0 },
      ],
    });
    expect(contactId).toEqual([]);
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
    expect(custom[0]).toMatchObject({ recommended: false, required: false });
  });

  it("carries the field description for the toggle hint", () => {
    const rows = listStudentRequirableFields(seedFields());
    const education = rows.find((row) => row.key === "education");
    expect(education?.descriptionKey).toBe("students.fields.educationDesc");
    const gender = rows.find((row) => row.key === "gender");
    expect(gender?.descriptionKey).toBe("students.fields.genderDesc");
  });
});

describe("setStudentFieldRequired", () => {
  it("toggles one field without mutating the input", () => {
    const fields = seedFields();
    const next = setStudentFieldRequired(fields, "dob", false);
    expect(requiredOf(next, "dob")).toBe(false);
    expect(requiredOf(fields, "dob")).toBe(true);
  });

  it("never makes the contact link optional", () => {
    const next = setStudentFieldRequired(seedFields(), "dob", false);
    expect(requiredOf(next, "contactId")).toBe(true);
  });

  it("leaves non-requirable fields untouched", () => {
    const fields = seedFields();
    const next = setStudentFieldRequired(fields, "registeredDate", true);
    expect(requiredOf(next, "registeredDate")).toBe(requiredOf(fields, "registeredDate"));
  });

  it("marks a custom field required by key", () => {
    const next = setStudentFieldRequired(withCustomField(seedFields()), "bFormNumber", true);
    expect(requiredOf(next, "bFormNumber")).toBe(true);
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
    const fields = setStudentFieldRequired(withCustomField(seedFields()), "bFormNumber", true);
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
      "education",
      false,
    );

    // Act
    const body = stripStudentFieldConfigForPersist({ ...settings, fields });
    const parsed = studentFieldConfigPutBodySchema.safeParse(body);

    // Assert
    expect(parsed.success).toBe(true);
  });
});

describe("required-field list composition", () => {
  it("lists the profile recommendations and hides registration/system rows", () => {
    // Arrange / Act
    const keys = listStudentRequirableFields(seedFields()).map((row) => row.key);

    // Assert
    expect(keys).toEqual(["gender", "dob", "contactRelationships", "address", "education"]);
    expect(keys).not.toContain("contactId");
    expect(keys).not.toContain("grNumber");
    expect(keys).not.toContain("status");
    expect(keys).not.toContain("notes");
  });

  it("marks exactly the recommended report rows on by default", () => {
    // Arrange / Act
    const rows = listStudentRequirableFields(seedFields());

    // Assert
    expect(rows.every((row) => row.required === row.recommended)).toBe(true);
    expect(rows.filter((row) => row.recommended).map((row) => row.key)).toEqual([
      ...STUDENT_RECOMMENDED_REQUIRED_FIELD_KEYS,
    ]);
  });
});

describe("contact-profile requirements", () => {
  it("resolves the enabled checks from a saved field map", () => {
    // Arrange / Act
    const requirements = resolveStudentContactProfileRequirements(seedFields());

    // Assert
    expect(requirements).toEqual({ relationships: true, address: true, education: true });
  });

  it("reports every gap for an incomplete contact", () => {
    // Act
    const gaps = resolveStudentContactProfileGaps(
      { id: "c-2", name: "Bare", firstName: "Bare" },
      { relationships: true, address: true, education: true },
    );

    // Assert
    expect(gaps).toEqual({ relationships: true, address: true, education: true });
  });

  it("clears the gaps once the Parent pair, Guardian, address and education exist", () => {
    // Arrange
    const contact = {
      id: "c-1",
      name: "Aisha",
      firstName: "Aisha",
      line1: "12 Madrasa Road",
      education: [{ institution: "Al-Noor Madrasa" }],
    };

    // Act
    const gaps = resolveStudentContactProfileGaps(
      contact,
      { relationships: true, address: true, education: true },
      { fatherContactId: "f-1", motherContactId: "m-1", guardianContactId: "g-1" },
    );

    // Assert
    expect(gaps).toEqual({ relationships: false, address: false, education: false });
  });

  it("treats a missing father or mother as an unmet relationship requirement", () => {
    // Act
    const gaps = resolveStudentContactProfileGaps(
      { id: "c-1", name: "Street", firstName: "Street", line1: "Street" },
      { relationships: true, address: false, education: false },
      { fatherContactId: "f-1", guardianContactId: "g-1" },
    );

    // Assert
    expect(gaps.relationships).toBe(true);
  });
});
