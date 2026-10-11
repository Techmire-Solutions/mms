import { describe, expect, it } from "vitest";
import type { FieldDefinition } from "./contactTypes.js";
import { normalizeQuestionBankSettings, type QuestionBankSettings } from "./settingsTypes.js";

describe("normalizeQuestionBankSettings", () => {
  it("migrates legacy flat field config into tabbed editor arrays", () => {
    const legacySettings: Partial<QuestionBankSettings> = {
      fields: {
        text: { enabled: true, required: true },
        categoryId: { enabled: true, required: false },
        type: { enabled: false, required: true },
        answer: { enabled: true, required: false },
      },
    };

    const normalized = normalizeQuestionBankSettings(legacySettings);

    expect(Array.isArray(normalized.fields?.basic)).toBe(true);
    expect(Array.isArray(normalized.fields?.options)).toBe(true);
    const basicFields = normalized.fields?.basic as FieldDefinition[];
    const optionsFields = normalized.fields?.options as FieldDefinition[];

    expect(basicFields.find((field) => field.key === "categoryId")).toMatchObject({
      enabled: true,
      required: false,
    });
    expect(optionsFields.find((field) => field.key === "type")).toMatchObject({
      enabled: false,
      required: true,
    });
    expect(optionsFields.find((field) => field.key === "answer")).toMatchObject({
      enabled: true,
      required: false,
    });
  });
});
