import { describe, expect, it } from "vitest";
import {
  listEnabledCustomStudentFormFields,
  listStudentSystemFormFieldKeys,
  isStudentSystemFormField,
} from "../studentFormCustomFields.js";
import type { FieldDefinition } from "../contactFieldSchemaTypes.js";

function field(partial: Partial<FieldDefinition> & { key: string }): FieldDefinition {
  return {
    label: partial.key,
    type: "text",
    enabled: true,
    order: 0,
    required: false,
    permissions: [],
    defaultValue: "",
    ...partial,
  };
}

describe("listEnabledCustomStudentFormFields", () => {
  it("scopes non-seed fields to the requested tab", () => {
    const fields = {
      basic: [field({ key: "gender", order: 0 }), field({ key: "house", order: 10 })],
      registration: [field({ key: "scholarshipNote", order: 0 })],
    };

    expect(listEnabledCustomStudentFormFields(fields, "basic").map((f) => f.key)).toEqual([
      "house",
    ]);
    expect(listEnabledCustomStudentFormFields(fields, "registration").map((f) => f.key)).toEqual([
      "scholarshipNote",
    ]);
  });

  it("excludes disabled and system seed keys", () => {
    const fields = {
      basic: [
        field({ key: "contactRelationships" }),
        field({ key: "hiddenCustom", enabled: false }),
        field({ key: "visibleCustom", enabled: true }),
      ],
    };

    expect(listEnabledCustomStudentFormFields(fields, "basic").map((f) => f.key)).toEqual([
      "visibleCustom",
    ]);
    expect(listStudentSystemFormFieldKeys().has("contactRelationships")).toBe(true);
    expect(listStudentSystemFormFieldKeys().has("contactId")).toBe(true);
    expect(listStudentSystemFormFieldKeys().has("grNumber")).toBe(true);
    expect(listStudentSystemFormFieldKeys().has("notes")).toBe(true);
    expect(isStudentSystemFormField("basic", "contactRelationships")).toBe(true);
    expect(isStudentSystemFormField("basic", "contactId")).toBe(true);
    expect(isStudentSystemFormField("registration", "status")).toBe(true);
  });

  it("aggregates all tabs when tabId is omitted", () => {
    const fields = {
      basic: [field({ key: "onBasic", order: 2 })],
      registration: [field({ key: "onRegistration", order: 1 })],
    };

    expect(listEnabledCustomStudentFormFields(fields).map((f) => f.key)).toEqual([
      "onRegistration",
      "onBasic",
    ]);
  });
});
