import { describe, expect, it } from "vitest";
import {
  DUPLICATE_THRESHOLD,
  hasComparableStem,
  isLikelyDuplicate,
  normalizeQuestionText,
  questionSimilarity,
  SIMILAR_THRESHOLD,
} from "./questionSimilarity.js";

describe("normalizeQuestionText", () => {
  it("folds case, punctuation and whitespace", () => {
    expect(normalizeQuestionText("  What   is 2 + 2?! ")).toBe("what is 2 2");
  });

  it("strips Arabic diacritics and unifies kaf/yeh variants", () => {
    const withDiacritics = "مَا هُوَ حُكْمُ الْوُضُوءِ";
    const plain = "ما هو حكم الوضوء";
    expect(normalizeQuestionText(withDiacritics)).toBe(normalizeQuestionText(plain));
    expect(normalizeQuestionText("كتاب")).toBe(normalizeQuestionText("کتاب"));
  });
});

describe("questionSimilarity", () => {
  it("scores an identical stem 1 and normalized-equal variants 1", () => {
    expect(questionSimilarity("Define tawalli.", "Define tawalli.")).toBe(1);
    expect(questionSimilarity("Define  TAWALLI!", "define tawalli")).toBe(1);
  });

  it("scores an unrelated stem below the similar threshold", () => {
    const score = questionSimilarity(
      "Which prayer is performed at dawn?",
      "Calculate the area of a circle with radius 4.",
    );
    expect(score).toBeLessThan(SIMILAR_THRESHOLD);
    expect(
      isLikelyDuplicate("Which prayer is performed at dawn?", "Calculate the area of a circle."),
    ).toBe(false);
  });

  it("flags a reworded stem as a duplicate", () => {
    const original = "Explain the significance of the event of Ghadir Khumm in Islamic history.";
    const reworded = "Explain the significance of the event of Ghadir Khumm in islamic history";
    expect(questionSimilarity(original, reworded)).toBeGreaterThanOrEqual(DUPLICATE_THRESHOLD);
    expect(isLikelyDuplicate(original, reworded)).toBe(true);
  });

  it("detects a near-identical stem with one changed word", () => {
    const original = "List the conditions of valid wudu before prayer.";
    const changed = "List the conditions of valid wudu before salah.";
    const score = questionSimilarity(original, changed);
    expect(score).toBeGreaterThan(SIMILAR_THRESHOLD);
    expect(score).toBeLessThan(1);
  });

  it("returns 0 for an empty stem", () => {
    expect(questionSimilarity("", "anything at all")).toBe(0);
    expect(questionSimilarity("   ", "   ")).toBe(0);
  });

  it("is symmetric", () => {
    const a = "State the three pillars of the fast.";
    const b = "State the three pillars of fasting.";
    expect(questionSimilarity(a, b)).toBe(questionSimilarity(b, a));
  });
});

describe("hasComparableStem", () => {
  it("rejects very short stems", () => {
    expect(hasComparableStem("2+2?")).toBe(false);
    expect(hasComparableStem("What is the ruling on combining prayers?")).toBe(true);
  });
});
