import { describe, expect, it } from "vitest";
import { sanitizeQuestionDraft } from "./questionFormPayload";
import type { QuestionFormDraft } from "./questionFormTypes";

const base: QuestionFormDraft = {
  categoryIds: ["  cat-1 ", "cat-1", ""],
  type: "mcq",
  difficulty: "easy",
  questionLanguage: "en",
  text: "  Question?  ",
  options: ["  A ", "", "B", ""],
  answer: "A",
  sourceCitations: [
    { bookId: "book-1", citation: { pageNumber: " 12 ", notes: "  " } },
    { bookId: "  ", citation: {} },
  ],
};

describe("sanitizeQuestionDraft", () => {
  it("trims MCQ options and drops blank rows/citations", () => {
    const result = sanitizeQuestionDraft(base);

    expect(result.text).toBe("Question?");
    expect(result.options).toEqual(["A", "B"]);
    expect(result.answer).toBe("A");
    expect(result.categoryIds).toEqual(["cat-1"]);
    expect(result.sourceCitations).toEqual([{ bookId: "book-1", citation: { pageNumber: "12" } }]);
  });

  it("rebuilds matching pairs and compound answers", () => {
    const result = sanitizeQuestionDraft({
      ...base,
      type: "matching",
      options: ["  Left A ", "Left B", ""],
      answer: "Right A ||| Right B |||",
    });

    expect(result.options).toEqual(["Left A", "Left B"]);
    expect(result.answer).toBe("Right A|||Right B");
  });

  it("rebuilds ordering answers and strips blank items", () => {
    const result = sanitizeQuestionDraft({
      ...base,
      type: "ordering",
      options: [" Second ", "", "First "],
      answer: "",
    });

    expect(result.options).toEqual(["Second", "First"]);
    expect(result.answer).toBe("Second|||First");
  });

  it("normalizes numeric tolerance and short answers", () => {
    const numeric = sanitizeQuestionDraft({
      ...base,
      type: "numeric",
      options: ["  0.5 ", ""],
      answer: " 42 ",
    });
    expect(numeric.options).toEqual(["0.5"]);
    expect(numeric.answer).toBe("42");

    const short = sanitizeQuestionDraft({ ...base, type: "short", options: ["A"], answer: " B " });
    expect(short.options).toEqual([]);
    expect(short.answer).toBe("B");
  });
});
