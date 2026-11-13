import { describe, expect, it } from "vitest";
import {
  normalizeQuestionBankModulePreferences,
  questionBankFieldConfigPutBodySchema,
  questionBankPreferencesPutBodySchema,
  questionBankPreferencesResponseSchema,
} from "./questionBankSetupConfigTypes.js";

const validPreferences = {
  aiGrading: true,
  defaultTestDuration: 45,
  categories: [{ id: "fiqh", name: "Fiqh", icon: "book", color: "#123456" }],
  sourceBooks: [
    {
      id: "book-1",
      name: "Fiqh al-Sunnah",
      fieldIds: ["sourceBookName", "sourceAuthor"],
      metadata: { bookName: "Fiqh al-Sunnah" },
    },
  ],
  questionTypes: [{ id: "mcq", enabled: true }],
  difficultyLevels: [{ id: "hard", enabled: false }],
};

describe("question bank preference schemas", () => {
  it("accepts a payload that matches the static registry types", () => {
    const parsed = questionBankPreferencesPutBodySchema.safeParse(validPreferences);
    expect(parsed.success).toBe(true);
  });

  it("rejects unknown keys and registry ids outside the taxonomy", () => {
    expect(
      questionBankPreferencesPutBodySchema.safeParse({ ...validPreferences, extra: true }).success,
    ).toBe(false);
    expect(
      questionBankPreferencesPutBodySchema.safeParse({
        ...validPreferences,
        questionTypes: [{ id: "essay", enabled: true }],
      }).success,
    ).toBe(false);
    expect(
      questionBankPreferencesPutBodySchema.safeParse({
        ...validPreferences,
        sourceBooks: [{ ...validPreferences.sourceBooks[0], fieldIds: ["nope"] }],
      }).success,
    ).toBe(false);
  });

  it("drops the retired customFields from the field-config payload", () => {
    expect(questionBankFieldConfigPutBodySchema.safeParse({ fieldOrder: [] }).success).toBe(true);
    expect(
      questionBankFieldConfigPutBodySchema.safeParse({ customFields: [{ id: "x" }] }).success,
    ).toBe(false);
  });

  it("parses the normalized preference response with the strict schema", () => {
    const normalized = normalizeQuestionBankModulePreferences(validPreferences);
    expect(questionBankPreferencesResponseSchema.safeParse(normalized).success).toBe(true);
    // A dirty legacy blob falls back per array instead of leaking an unreadable shape.
    const dirty = normalizeQuestionBankModulePreferences({
      ...validPreferences,
      categories: [{ id: "fiqh" }],
    });
    expect(questionBankPreferencesResponseSchema.safeParse(dirty).success).toBe(true);
  });
});
