import { describe, expect, it } from "vitest";
import { questionBankQuestionWriteSchema } from "./questionBankModuleManifest.js";

const validBase = {
  id: "q1",
  categoryIds: ["cat-1"],
  type: "mcq" as const,
  difficulty: "easy" as const,
  questionLanguage: "en" as const,
  text: "What is 2 + 2?",
  options: ["3", "4", "5"],
  answer: "4",
};

describe("questionBankQuestionWriteSchema", () => {
  it("accepts a valid question", () => {
    expect(questionBankQuestionWriteSchema.safeParse(validBase).success).toBe(true);
  });

  it("rejects empty question text", () => {
    const result = questionBankQuestionWriteSchema.safeParse({ ...validBase, text: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("questionBank.validation.textRequired");
    }
  });

  it("rejects an empty categoryIds array", () => {
    const result = questionBankQuestionWriteSchema.safeParse({ ...validBase, categoryIds: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message === "questionBank.validation.categoryRequired"),
      ).toBe(true);
    }
  });

  it("rejects an mcq answer not present in options", () => {
    const result = questionBankQuestionWriteSchema.safeParse({ ...validBase, answer: "6" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message === "questionBank.validation.answerFromChoices"),
      ).toBe(true);
    }
  });

  it("requires an answer for true_false questions", () => {
    const result = questionBankQuestionWriteSchema.safeParse({
      ...validBase,
      type: "true_false",
      options: ["True", "False"],
      answer: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message === "questionBank.validation.trueFalseRequired"),
      ).toBe(true);
    }
  });

  it("is strict — rejects unknown keys", () => {
    const result = questionBankQuestionWriteSchema.safeParse({
      ...validBase,
      deletedAt: "2026-01-01",
    });
    expect(result.success).toBe(false);
  });
});
