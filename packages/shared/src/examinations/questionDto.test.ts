import { describe, expect, it } from "vitest";
import type { QuestionBankQuestion } from "./questionBankEntityTypes.js";
import { isMcqQuestion, isTrueFalseQuestion, toQuestionDto } from "./questionDto.js";

const base: QuestionBankQuestion = {
  id: "q-1",
  categoryIds: ["fiqh"],
  type: "mcq",
  difficulty: "easy",
  questionLanguage: "en",
  text: "What is the capital of Egypt?",
  options: ["Cairo", "Giza"],
  answer: "Cairo",
};

describe("QuestionDto narrowing", () => {
  it("narrows a valid mcq to a two-tuple of options", () => {
    const dto = toQuestionDto(base);
    expect(dto).not.toBeNull();
    if (!dto) return;
    expect(dto.type).toBe("mcq");
    if (dto.type === "mcq") {
      // Compile-time: the tuple guarantees two options.
      expect(dto.options[0]).toBe("Cairo");
    }
    expect(isMcqQuestion(base)).toBe(true);
  });

  it("accepts the localized true/false label model", () => {
    const trueFalse: QuestionBankQuestion = {
      ...base,
      type: "true_false",
      options: ["True", "False"],
      answer: "True",
    };
    expect(toQuestionDto(trueFalse)?.type).toBe("true_false");
    expect(isTrueFalseQuestion(trueFalse)).toBe(true);
  });

  it("rejects records that violate the per-type invariants", () => {
    expect(toQuestionDto({ ...base, options: ["Cairo"] })).toBeNull();
    expect(toQuestionDto({ ...base, answer: "Alexandria" })).toBeNull();
    expect(
      toQuestionDto({ ...base, type: "short", options: ["Cairo"], answer: "Cairo" }),
    ).toBeNull();
    expect(
      toQuestionDto({ ...base, type: "true_false", options: ["True"], answer: "True" }),
    ).toBeNull();
  });

  it("narrows short answers and structured types", () => {
    const short: QuestionBankQuestion = { ...base, type: "short", options: [], answer: "Purity" };
    expect(toQuestionDto(short)?.type).toBe("short");

    const matching: QuestionBankQuestion = {
      ...base,
      type: "matching",
      options: ["A", "B"],
      answer: "1|||2",
    };
    expect(toQuestionDto(matching)?.type).toBe("matching");
  });
});
