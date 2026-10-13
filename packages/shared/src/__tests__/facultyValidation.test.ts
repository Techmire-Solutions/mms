import { describe, expect, it } from "vitest";
import {
  FACULTY_WRITE_SYSTEM_KEYS,
  buildDynamicFacultySchema,
  formatFacultyZodIssues,
} from "../faculty/facultyValidation.js";
import { listFacultySystemFormFieldKeys } from "../faculty/facultyFormCustomFields.js";
import {
  DEFAULT_FACULTY_SETTINGS,
  type FacultySettings,
} from "../faculty/facultyModuleSettings.js";
import { INITIAL_FACULTY_FIELD_SEED } from "../settings/moduleFieldSetupFaculty.js";
import type { FieldDefinition } from "../contacts/contactTypes.js";

describe("buildDynamicFacultySchema", () => {
  const settings: FacultySettings = {
    ...DEFAULT_FACULTY_SETTINGS,
    requireContactLink: true,
  };
  const enabledTabs = new Set(["basic", "employment", "designation"]);
  const fields: Record<string, FieldDefinition[]> = {
    basic: INITIAL_FACULTY_FIELD_SEED.basic.map((field) => ({ ...field })),
    employment: INITIAL_FACULTY_FIELD_SEED.employment.map((field) => ({ ...field })),
    designation: INITIAL_FACULTY_FIELD_SEED.designation.map((field) => ({ ...field })),
  };
  const validPayload = {
    contactId: "c-1",
    specialization: "Hifz",
    status: "active",
    employDesignationStatus: "active",
    profileStatus: "active",
    employeeId: "FAC-1",
    designationId: "des-1",
    designationStartDate: "2024-01-15",
    employmentStartDate: "2024-01-15",
  };

  it("accepts a valid faculty write payload", () => {
    const schema = buildDynamicFacultySchema(settings, enabledTabs, fields);
    const result = schema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("given an unknown status, should reject with the status enum", () => {
    const schema = buildDynamicFacultySchema(settings, enabledTabs, fields);
    const result = schema.safeParse({ ...validPayload, status: "sabbatical" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === "status")).toBe(true);
    }
  });

  it("given every lifecycle status, should accept retired and terminated", () => {
    const schema = buildDynamicFacultySchema(settings, enabledTabs, fields);
    for (const status of ["active", "on_leave", "inactive", "retired", "terminated"]) {
      expect(schema.safeParse({ ...validPayload, status }).success).toBe(true);
    }
  });

  it("given an employment end date before the start date, should reject on employmentEndDate", () => {
    const schema = buildDynamicFacultySchema(settings, enabledTabs, fields);
    const result = schema.safeParse({ ...validPayload, employmentEndDate: "2023-12-31" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === "employmentEndDate")).toBe(true);
    }
  });

  it("given a client-supplied performanceRating, should strip it (server-computed)", () => {
    const schema = buildDynamicFacultySchema(settings, enabledTabs, fields);
    const result = schema.safeParse({ ...validPayload, performanceRating: 4.9 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).performanceRating).toBeUndefined();
    }
  });

  it("requires contactId (contact link is compulsory)", () => {
    const schema = buildDynamicFacultySchema(settings, enabledTabs, fields);
    const result = schema.safeParse({
      contactId: "",
      specialization: "Hifz",
      status: "active",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const formatted = formatFacultyZodIssues(result.error, {}, fields);
      expect(formatted.some((err) => err.fieldId === "contactId")).toBe(true);
    }
  });

  it("requires contactId even when Setup disables the contact field", () => {
    const disabledContact: Record<string, FieldDefinition[]> = {
      basic: fields.basic.map((field) =>
        field.key === "contactId" ? { ...field, enabled: false, required: false } : field,
      ),
      employment: fields.employment,
    };
    const schema = buildDynamicFacultySchema(settings, enabledTabs, disabledContact);
    const result = schema.safeParse({
      status: "active",
      employeeId: "FAC-1",
      designationId: "des-1",
      employmentStartDate: "2024-01-15",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const formatted = formatFacultyZodIssues(result.error, {}, disabledContact);
      expect(formatted.some((err) => err.fieldId === "contactId")).toBe(true);
    }
  });

  it("requires designationId when the designation tab is enabled", () => {
    const schema = buildDynamicFacultySchema(settings, enabledTabs, fields);
    const result = schema.safeParse({ ...validPayload, designationId: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === "designationId")).toBe(true);
    }
  });

  it("requires employmentStartDate when the seed marks it required", () => {
    const schema = buildDynamicFacultySchema(settings, enabledTabs, fields);
    const result = schema.safeParse({ ...validPayload, employmentStartDate: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === "employmentStartDate")).toBe(
        true,
      );
    }
  });

  it("requires enabled custom fields and maps tab id", () => {
    const withCustom: Record<string, FieldDefinition[]> = {
      ...fields,
      employment: [
        ...fields.employment,
        {
          key: "badgeColor",
          label: "Badge",
          type: "text",
          enabled: true,
          required: true,
          order: 99,
        },
      ],
    };
    const schema = buildDynamicFacultySchema(settings, enabledTabs, withCustom);
    const result = schema.safeParse(validPayload);
    expect(result.success).toBe(false);
    if (!result.success) {
      const formatted = formatFacultyZodIssues(result.error, {}, withCustom);
      expect(
        formatted.some((err) => err.fieldId === "badgeColor" && err.tabId === "employment"),
      ).toBe(true);
    }
  });

  it("accepts employDesignations write-through rows and employmentId", () => {
    const schema = buildDynamicFacultySchema(settings, enabledTabs, fields);
    const result = schema.safeParse({
      ...validPayload,
      employmentId: "emp-1",
      employDesignations: [
        {
          designationId: "des-1",
          designationStartDate: "2024-01-15",
          employDesignationStatus: "active",
        },
        {
          employDesignationId: "fed-2",
          designationId: "des-2",
          designationStartDate: "2025-01-01",
          designationEndDate: null,
          employDesignationStatus: "inactive",
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const data = result.data as Record<string, unknown>;
      expect(data.employmentId).toBe("emp-1");
      expect(Array.isArray(data.employDesignations)).toBe(true);
      expect((data.employDesignations as unknown[]).length).toBe(2);
    }
  });

  it("rejects unknown keys via .strict()", () => {
    const schema = buildDynamicFacultySchema(settings, enabledTabs, fields);
    const result = schema.safeParse({
      contactId: "c-1",
      specialization: "Hifz",
      status: "active",
      notARealField: "x",
    });
    expect(result.success).toBe(false);
  });

  it("strips contact profile dual-write keys before validation", () => {
    const schema = buildDynamicFacultySchema(settings, enabledTabs, fields);
    const result = schema.safeParse({
      ...validPayload,
      name: "Should Strip",
      phone: "+10000000000",
      email: "a@b.c",
      gender: "male",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const data = result.data as Record<string, unknown>;
      expect(data.name).toBeUndefined();
      expect(data.phone).toBeUndefined();
      expect(data.email).toBeUndefined();
      expect(data.gender).toBeUndefined();
    }
  });
});

describe("FACULTY_WRITE_SYSTEM_KEYS", () => {
  it("includes every seed system field key plus audit meta keys", () => {
    for (const key of listFacultySystemFormFieldKeys()) {
      expect(FACULTY_WRITE_SYSTEM_KEYS).toContain(key);
    }
    for (const key of ["id", "userId", "createdAt", "updatedAt", "createdBy", "updatedBy"]) {
      expect(FACULTY_WRITE_SYSTEM_KEYS).toContain(key);
    }
    for (const key of ["joinDate", "employmentId", "employDesignations"]) {
      expect(FACULTY_WRITE_SYSTEM_KEYS).toContain(key);
    }
  });
});
