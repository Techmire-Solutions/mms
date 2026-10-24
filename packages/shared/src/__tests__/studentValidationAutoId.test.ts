import { describe, expect, it } from "vitest";
import { buildDynamicStudentSchema } from "../students/studentValidation.js";
import { DEFAULT_STUDENTS_SETTINGS } from "../settings/settingsTypes.js";
import type { FieldDefinition } from "../contacts/contactTypes.js";

describe("studentValidationAutoId", () => {
  const fields = {
    basic: [
      {
        key: "contactId",
        label: "C",
        type: "text",
        enabled: true,
        required: true,
        order: 0,
      } as FieldDefinition,
    ],
    registration: [
      {
        key: "grNumber",
        label: "GR",
        type: "text",
        enabled: true,
        required: true,
        order: 0,
      } as FieldDefinition,
    ],
  };
  const enabledTabs = new Set(["basic", "registration"]);
  const requiredTabs = new Set(["basic"]);

  it("allows blank grNumber when autoGenerateId is true", () => {
    const schema = buildDynamicStudentSchema(
      { ...DEFAULT_STUDENTS_SETTINGS, autoGenerateId: true },
      enabledTabs,
      requiredTabs,
      fields,
    );
    expect(schema.safeParse({ contactId: "c-1", grNumber: "" }).success).toBe(true);
    expect(schema.safeParse({ contactId: "c-1" }).success).toBe(true);
  });

  it("enforces grNumber when autoGenerateId is false and field is required", () => {
    const schema = buildDynamicStudentSchema(
      { ...DEFAULT_STUDENTS_SETTINGS, autoGenerateId: false },
      enabledTabs,
      requiredTabs,
      fields,
    );
    expect(schema.safeParse({ contactId: "c-1", grNumber: "" }).success).toBe(false);
    expect(schema.safeParse({ contactId: "c-1" }).success).toBe(false);
    expect(schema.safeParse({ contactId: "c-1", grNumber: "GR-100" }).success).toBe(true);
  });
});
