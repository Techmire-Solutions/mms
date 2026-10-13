import { describe, expect, it } from "vitest";
import {
  buildDynamicStudentSchema,
  formatStudentZodIssues,
} from "../students/studentValidation.js";
import { DEFAULT_STUDENTS_SETTINGS, type StudentsSettings } from "../settings/settingsTypes.js";
import type { FieldDefinition } from "../contacts/contactTypes.js";

describe("studentValidation", () => {
  const mockSettings: StudentsSettings = {
    ...DEFAULT_STUDENTS_SETTINGS,
    formTabs: [
      { key: "basic", label: "Identity", enabled: true, order: 0 },
      { key: "registration", label: "Registration", enabled: true, order: 1 },
    ],
  };

  const mockEnabledTabIds = new Set(["basic", "registration"]);
  const mockRequiredTabIds = new Set(["basic"]);

  const mockFields: Record<string, FieldDefinition[]> = {
    basic: [
      {
        key: "contactId",
        label: "Student contact",
        type: "text",
        enabled: true,
        required: true,
        order: 0,
      },
      {
        key: "category",
        label: "Category",
        type: "select",
        enabled: true,
        required: false,
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
        key: "grNumber",
        label: "GR Number",
        type: "text",
        enabled: true,
        required: true,
        order: 0,
      },
      { key: "status", label: "Status", type: "select", enabled: true, required: true, order: 1 },
      {
        key: "registeredDate",
        label: "Registration Date",
        type: "date",
        enabled: true,
        required: false,
        order: 2,
      },
    ],
  };

  it("validates a correct student payload", () => {
    const schema = buildDynamicStudentSchema(
      mockSettings,
      mockEnabledTabIds,
      mockRequiredTabIds,
      mockFields,
    );

    const validPayload = {
      contactId: "c-100",
      grNumber: "GR-1234",
      status: "active",
    };

    const result = schema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("fails validation when required contactId is missing", () => {
    const schema = buildDynamicStudentSchema(
      mockSettings,
      mockEnabledTabIds,
      mockRequiredTabIds,
      mockFields,
    );

    const invalidPayload = {
      contactId: "",
      grNumber: "GR-1234",
      status: "active",
    };

    const result = schema.safeParse(invalidPayload);
    expect(result.success).toBe(false);
    if (!result.success) {
      const formatted = formatStudentZodIssues(result.error, invalidPayload, mockFields);
      expect(formatted.some((err) => err.fieldId === "contactId")).toBe(true);
      expect(formatted.find((err) => err.fieldId === "contactId")?.tabId).toBe("basic");
    }
  });

  it("maps registration field errors to the registration form tab", () => {
    const fieldsWithRequiredCustom: Record<string, FieldDefinition[]> = {
      ...mockFields,
      registration: [
        ...mockFields.registration,
        {
          key: "scholarshipNote",
          label: "Scholarship",
          type: "text",
          enabled: true,
          required: true,
          order: 1,
        },
      ],
    };

    const schema = buildDynamicStudentSchema(
      mockSettings,
      mockEnabledTabIds,
      mockRequiredTabIds,
      fieldsWithRequiredCustom,
    );

    const payload = {
      contactId: "c-100",
      grNumber: "GR-1234",
      status: "active",
    };

    const result = schema.safeParse(payload);
    expect(result.success).toBe(false);
    if (!result.success) {
      const formatted = formatStudentZodIssues(result.error, payload, fieldsWithRequiredCustom);
      expect(formatted.find((err) => err.fieldId === "scholarshipNote")?.tabId).toBe(
        "registration",
      );
    }
  });

  it("skips contactId / grNumber / status validators when those seed fields are disabled", () => {
    const fieldsDisabledCore: Record<string, FieldDefinition[]> = {
      basic: [
        {
          key: "contactId",
          label: "Student contact",
          type: "text",
          enabled: false,
          required: true,
          order: 0,
        },
        {
          key: "contactRelationships",
          label: "Relationships",
          type: "text",
          enabled: true,
          required: false,
          order: 1,
        },
      ],
      registration: [
        {
          key: "grNumber",
          label: "GR Number",
          type: "text",
          enabled: false,
          required: true,
          order: 0,
        },
        {
          key: "status",
          label: "Status",
          type: "select",
          enabled: false,
          required: true,
          order: 1,
        },
        {
          key: "notes",
          label: "Notes",
          type: "textarea",
          enabled: true,
          required: false,
          order: 2,
        },
      ],
    };

    const schema = buildDynamicStudentSchema(
      mockSettings,
      mockEnabledTabIds,
      mockRequiredTabIds,
      fieldsDisabledCore,
    );

    const result = schema.safeParse({ notes: "ok" });
    expect(result.success).toBe(true);
  });

  it("allows empty grNumber / status when enabled but not required", () => {
    const fieldsOptionalCore: Record<string, FieldDefinition[]> = {
      basic: [
        {
          key: "contactId",
          label: "Student contact",
          type: "text",
          enabled: true,
          required: true,
          order: 0,
        },
      ],
      registration: [
        {
          key: "grNumber",
          label: "GR Number",
          type: "text",
          enabled: true,
          required: false,
          order: 0,
        },
        {
          key: "status",
          label: "Status",
          type: "select",
          enabled: true,
          required: false,
          order: 1,
        },
      ],
    };

    const schema = buildDynamicStudentSchema(
      mockSettings,
      mockEnabledTabIds,
      mockRequiredTabIds,
      fieldsOptionalCore,
    );

    expect(schema.safeParse({ contactId: "c-1" }).success).toBe(true);
    expect(schema.safeParse({ contactId: "" }).success).toBe(false);
  });

  it("still requires contactId when the field is enabled even if Setup marks it optional", () => {
    const fields: Record<string, FieldDefinition[]> = {
      basic: [
        {
          key: "contactId",
          label: "Student contact",
          type: "text",
          enabled: true,
          required: false,
          order: 0,
        },
      ],
      registration: [],
    };

    const schema = buildDynamicStudentSchema(
      mockSettings,
      mockEnabledTabIds,
      mockRequiredTabIds,
      fields,
    );

    expect(schema.safeParse({}).success).toBe(false);
    expect(schema.safeParse({ contactId: "c-1" }).success).toBe(true);
  });
});
