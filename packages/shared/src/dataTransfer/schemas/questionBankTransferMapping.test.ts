import { describe, expect, it } from "vitest";
import type { QuestionBankQuestion } from "../../examinations/questionBankEntityTypes.js";
import {
  questionToTransferEntity,
  transferRowToQuestionInput,
} from "./questionBankTransferMapping.js";

const stored: QuestionBankQuestion = {
  id: "q-1",
  categoryIds: ["fiqh"],
  type: "short",
  difficulty: "medium",
  questionLanguage: "en",
  text: "What is wudu?",
  options: [],
  answer: "ritual purity",
  marks: 4,
  sourceCitations: [{ bookId: "book-1", citation: { bookName: "Fiqh al-Sunnah" } }],
  status: "approved",
};

describe("question bank transfer mapping", () => {
  it("round-trips a stored question through the transfer row", () => {
    const row = questionToTransferEntity(stored);
    expect(row).toMatchObject({
      title: "What is wudu?",
      category: "fiqh",
      difficulty: "medium",
      type: "short",
      points: 4,
      explanation: "ritual purity",
      source: "Fiqh al-Sunnah",
      status: "approved",
    });

    const mapped = transferRowToQuestionInput(row);
    expect(mapped.ok).toBe(true);
    if (!mapped.ok) return;
    expect(mapped.value).toMatchObject({
      text: "What is wudu?",
      categoryIds: ["fiqh"],
      difficulty: "medium",
      type: "short",
      answer: "ritual purity",
      marks: 4,
      questionLanguage: "en",
    });
  });

  it("normalises difficulty and type aliases", () => {
    const mapped = transferRowToQuestionInput({
      title: "Explain the treaty.",
      category: "history",
      difficulty: "Advanced",
      type: "open-ended",
      explanation: "It was signed in 628.",
    });
    expect(mapped.ok).toBe(true);
    if (!mapped.ok) return;
    expect(mapped.value.difficulty).toBe("hard");
    expect(mapped.value.type).toBe("short");
    expect(mapped.value.marks).toBe(1);
  });

  it("defaults unknown difficulty to medium", () => {
    const mapped = transferRowToQuestionInput({
      title: "Define tawhid.",
      category: "aqidah",
      difficulty: "legendary",
      type: "text",
      explanation: "Oneness of God.",
    });
    expect(mapped.ok && mapped.value.difficulty).toBe("medium");
  });

  it("rejects pair/order types that a flat row cannot represent", () => {
    for (const type of ["matching", "ordering"]) {
      const mapped = transferRowToQuestionInput({
        title: "Match the columns",
        category: "fiqh",
        type,
        explanation: "A",
      });
      expect(mapped.ok, type).toBe(false);
      if (!mapped.ok) expect(mapped.reason).toMatch(/authoring form/);
    }
  });

  it("parses pipe-separated mcq options and canonicalises the answer", () => {
    const mapped = transferRowToQuestionInput({
      title: "What is the capital of Egypt?",
      category: "geography",
      type: "mcq",
      options: "Cairo | Alexandria | Giza",
      explanation: " cairo ",
      points: "2",
    });
    expect(mapped.ok).toBe(true);
    if (!mapped.ok) return;
    expect(mapped.value.options).toEqual(["Cairo", "Alexandria", "Giza"]);
    expect(mapped.value.answer).toBe("Cairo");
    expect(mapped.value.marks).toBe(2);
  });

  it("rejects mcq rows with too few options or an answer outside them", () => {
    const tooFew = transferRowToQuestionInput({
      title: "Pick one",
      category: "fiqh",
      type: "mcq",
      options: "Only one",
      explanation: "Only one",
    });
    expect(tooFew.ok).toBe(false);

    const outside = transferRowToQuestionInput({
      title: "Pick one",
      category: "fiqh",
      type: "mcq",
      options: "A | B",
      explanation: "C",
    });
    expect(outside.ok).toBe(false);
    if (!outside.ok) expect(outside.reason).toMatch(/match one of the options/);
  });

  it("accepts true/false answers and drops any options column", () => {
    const mapped = transferRowToQuestionInput({
      title: "Wudu is required for prayer.",
      category: "fiqh",
      type: "true-false",
      options: "ignored | ignored",
      explanation: "TRUE",
    });
    expect(mapped.ok).toBe(true);
    if (!mapped.ok) return;
    expect(mapped.value.answer).toBe("true");
    expect(mapped.value.options).toEqual([]);

    const bad = transferRowToQuestionInput({
      title: "Wudu is required for prayer.",
      category: "fiqh",
      type: "true_false",
      explanation: "maybe",
    });
    expect(bad.ok).toBe(false);
  });

  it("exports mcq options with the pipe separator", () => {
    const row = questionToTransferEntity({
      id: "q-mcq",
      categoryIds: ["geography"],
      type: "mcq",
      difficulty: "easy",
      questionLanguage: "en",
      text: "Capital?",
      options: ["Cairo", "Giza"],
      answer: "Cairo",
      status: "approved",
    });
    expect(row.options).toBe("Cairo | Giza");
  });

  it("requires a stem, a category, an answer and valid marks", () => {
    expect(transferRowToQuestionInput({ category: "x", explanation: "a" }).ok).toBe(false);
    expect(transferRowToQuestionInput({ title: "t", explanation: "a" }).ok).toBe(false);
    expect(transferRowToQuestionInput({ title: "t", category: "c" }).ok).toBe(false);
    expect(
      transferRowToQuestionInput({ title: "t", category: "c", explanation: "a", points: "0" }).ok,
    ).toBe(false);
    expect(
      transferRowToQuestionInput({ title: "t", category: "c", explanation: "a", points: "2.5" }).ok,
    ).toBe(false);
  });

  it("requires underscores for fill-in-the-blank stems", () => {
    expect(
      transferRowToQuestionInput({
        title: "The capital of Egypt is ____.",
        category: "geography",
        type: "fill",
        explanation: "Cairo",
      }).ok,
    ).toBe(true);
    const bad = transferRowToQuestionInput({
      title: "The capital of Egypt is Cairo.",
      category: "geography",
      type: "fill_blank",
      explanation: "Cairo",
    });
    expect(bad.ok).toBe(false);
  });

  it("ignores the status column (imports are always drafts)", () => {
    const mapped = transferRowToQuestionInput({
      title: "Draft me",
      category: "fiqh",
      type: "short",
      explanation: "a",
      status: "approved",
    });
    expect(mapped.ok && "status" in mapped.value).toBe(false);
  });
});
