import { describe, expect, it } from "vitest";
import { buildCustomFieldSchema } from "./contactFieldValidation.js";
import type { FieldDefinition } from "./contactFieldSchemaTypes.js";

function field(
  partial: Partial<FieldDefinition> & Pick<FieldDefinition, "key" | "type">,
): FieldDefinition {
  return {
    label: partial.label ?? partial.key,
    enabled: true,
    order: 0,
    required: false,
    ...partial,
  };
}

describe("buildCustomFieldSchema", () => {
  it("accepts numeric contact ids for required text fields", () => {
    const schema = buildCustomFieldSchema(
      field({ key: "contactId", label: "Contact", type: "text", required: true }),
    );
    expect(schema.safeParse(42).success).toBe(true);
    expect(schema.safeParse("").success).toBe(false);
  });

  it("accepts only system catalog labels on relationship fields", () => {
    const schema = buildCustomFieldSchema(
      field({
        key: "relationship",
        label: "Relationship",
        type: "select",
        required: false,
        options: ["Husband", "Wife", "Spouse"],
      }),
    );
    expect(schema.safeParse("Husband").success).toBe(true);
    expect(schema.safeParse("Parent").success).toBe(true);
    expect(schema.safeParse("Mentor").success).toBe(false);
    expect(schema.safeParse("Spouse").success).toBe(false);
  });

  it("rejects unlisted options for non-relationship select fields", () => {
    const schema = buildCustomFieldSchema(
      field({
        key: "gender",
        label: "Gender",
        type: "select",
        required: false,
        options: ["Male", "Female"],
      }),
    );
    expect(schema.safeParse("Male").success).toBe(true);
    expect(schema.safeParse("Unknown").success).toBe(false);
  });
});
