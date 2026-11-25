import { describe, expect, it } from "vitest";
import {
  QUESTION_DIFFICULTIES,
  QUESTION_LANGUAGES,
  QUESTION_STATUSES,
  QUESTION_TYPES,
  languagesMatchAppLanguages,
  questionDifficultySchema,
  questionLanguageSchema,
  questionStatusSchema,
  questionTypeSchema,
} from "./questionTaxonomy.js";

describe("question taxonomy", () => {
  it("keeps the language list aligned with the app languages", () => {
    expect(languagesMatchAppLanguages()).toBe(true);
  });

  it("derives every zod enum from the single array", () => {
    expect(questionTypeSchema.options).toEqual([...QUESTION_TYPES]);
    expect(questionDifficultySchema.options).toEqual([...QUESTION_DIFFICULTIES]);
    expect(questionLanguageSchema.options).toEqual([...QUESTION_LANGUAGES]);
    expect(questionStatusSchema.options).toEqual([...QUESTION_STATUSES]);
  });
});
