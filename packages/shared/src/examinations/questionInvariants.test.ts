import { describe, expect, it } from "vitest";
import {
  firstQuestionInvariantIssue,
  validateQuestionByType,
  type QuestionInvariantInput,
} from "./questionInvariants.js";

const base: QuestionInvariantInput = {
  type: "mcq",
  text: "What is 2 + 2?",
  options: ["3", "4", "5"],
  answer: "4",
  marks: 1,
  categoryIds: ["cat-1"],
};

function codes(input: QuestionInvariantInput): string[] {
  return validateQuestionByType(input).map((issue) => issue.code);
}

describe("validateQuestionByType — valid shapes per type", () => {
  it.each<[string, QuestionInvariantInput]>([
    ["mcq", { ...base }],
    ["true_false", { ...base, type: "true_false", options: ["True", "False"], answer: "True" }],
    ["short", { ...base, type: "short", options: [], answer: "Two plus two is four" }],
    [
      "fill_blank",
      { ...base, type: "fill_blank", options: [], text: "The ___ is ___", answer: "sum|||four" },
    ],
    ["numeric", { ...base, type: "numeric", options: ["0.5"], answer: "4" }],
    ["matching", { ...base, type: "matching", options: ["a", "b"], answer: "1|||2" }],
    [
      "ordering",
      { ...base, type: "ordering", options: ["first", "second"], answer: "first|||second" },
    ],
  ])("accepts a well-formed %s", (_type, input) => {
    expect(validateQuestionByType(input)).toEqual([]);
  });
});

describe("validateQuestionByType — common rules", () => {
  it("rejects a whitespace-only stem", () => {
    expect(codes({ ...base, text: "   " })).toContain("text_required");
  });

  it("rejects a question with no category", () => {
    expect(codes({ ...base, categoryIds: ["  "] })).toContain("category_required");
  });

  it("rejects zero, negative and fractional marks", () => {
    expect(codes({ ...base, marks: 0 })).toContain("marks_positive");
    expect(codes({ ...base, marks: -2 })).toContain("marks_positive");
    expect(codes({ ...base, marks: 1.5 })).toContain("marks_positive");
  });

  it("skips marks validation when marks are omitted (the caller applies the default)", () => {
    expect(codes({ ...base, marks: undefined })).toEqual([]);
  });
});

describe("validateQuestionByType — single-choice MCQ", () => {
  it("requires at least two options", () => {
    expect(codes({ ...base, options: ["4"] })).toContain("option_count");
    expect(codes({ ...base, options: [] })).toContain("option_count");
  });

  it("requires exactly one correct option, and it must be one of them", () => {
    expect(codes({ ...base, answer: "" })).toContain("answer_required");
    expect(codes({ ...base, answer: "6" })).toContain("answer_not_in_options");
  });

  it("rejects duplicate choices ignoring case and surrounding space", () => {
    expect(codes({ ...base, options: ["4", " 4 "], answer: "4" })).toContain("duplicate_options");
  });
});

describe("validateQuestionByType — true / false", () => {
  it("requires exactly two options", () => {
    expect(codes({ ...base, type: "true_false", options: ["True"], answer: "True" })).toContain(
      "true_false_options",
    );
  });

  it("requires the answer to be one of the two options", () => {
    expect(
      codes({ ...base, type: "true_false", options: ["True", "False"], answer: "maybe" }),
    ).toContain("answer_not_in_options");
    expect(
      codes({ ...base, type: "true_false", options: ["True", "False"], answer: "" }),
    ).toContain("true_false_required");
  });
});

describe("validateQuestionByType — typed formats", () => {
  it("short answers carry no options and a non-empty answer", () => {
    expect(codes({ ...base, type: "short", options: ["stale"], answer: "ok" })).toContain(
      "option_not_allowed",
    );
    expect(codes({ ...base, type: "short", options: [], answer: "  " })).toContain(
      "answer_required",
    );
  });

  it("fill_blank needs markers and one answer per marker", () => {
    expect(
      codes({ ...base, type: "fill_blank", options: [], text: "no blanks here", answer: "x" }),
    ).toContain("blank_markers");
    expect(
      codes({ ...base, type: "fill_blank", options: [], text: "a ___ b ___", answer: "one" }),
    ).toContain("blank_answer_count");
  });

  it("numeric answers must parse and tolerance must be a non-negative number", () => {
    expect(codes({ ...base, type: "numeric", options: [], answer: "about four" })).toContain(
      "numeric_answer",
    );
    expect(codes({ ...base, type: "numeric", options: ["-1"], answer: "4" })).toContain(
      "numeric_tolerance",
    );
    expect(codes({ ...base, type: "numeric", options: ["x"], answer: "4" })).toContain(
      "numeric_tolerance",
    );
  });

  it("matching needs two pairs and a complete right-hand side", () => {
    expect(codes({ ...base, type: "matching", options: ["a"], answer: "1" })).toContain(
      "matching_pairs",
    );
    expect(
      codes({ ...base, type: "matching", options: ["a", "b", "c"], answer: "1|||2" }),
    ).toContain("matching_incomplete");
    expect(codes({ ...base, type: "matching", options: ["a", "b"], answer: "1|||1" })).toContain(
      "duplicate_options",
    );
  });

  it("ordering needs two items and an answer matching the item order", () => {
    expect(codes({ ...base, type: "ordering", options: ["only"], answer: "only" })).toContain(
      "ordering_items",
    );
    expect(codes({ ...base, type: "ordering", options: ["a", "b"], answer: "b|||a" })).toContain(
      "ordering_answer",
    );
  });
});

describe("firstQuestionInvariantIssue", () => {
  it("returns the first issue with a translation key", () => {
    const issue = firstQuestionInvariantIssue({ ...base, options: [] });
    expect(issue).toMatchObject({
      code: "option_count",
      messageKey: "questionBank.validation.optionCount",
    });
  });

  it("returns null for a valid question", () => {
    expect(firstQuestionInvariantIssue(base)).toBeNull();
  });
});
