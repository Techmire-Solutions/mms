import { joinQuestionCompoundAnswer, splitQuestionCompoundAnswer } from "./questionBankCore.js";
import type { QuestionBankQuestion } from "./questionBankEntities.js";

export function getMatchingPairCount(
  question: Pick<QuestionBankQuestion, "type" | "options" | "answer">,
): number {
  if (question.type !== "matching") return 0;
  return Math.max(
    question.options.filter(Boolean).length,
    splitQuestionCompoundAnswer(question.answer).length,
  );
}

/** Whether a student response matches the configured correct answer. */
export function isQuestionAnswerCorrect(
  question: Pick<QuestionBankQuestion, "type" | "answer" | "options">,
  studentAnswer: string | undefined,
): boolean {
  if (!studentAnswer?.trim()) return false;
  const student = studentAnswer.trim();
  const expected = question.answer.trim();

  switch (question.type) {
    case "mcq":
    case "true_false":
      return student === expected;
    case "short":
      return student.toLowerCase() === expected.toLowerCase();
    case "numeric": {
      const target = Number(expected);
      const actual = Number(student);
      const tolerance = Number(question.options?.[0] ?? 0);
      if (Number.isNaN(target) || Number.isNaN(actual)) return false;
      const delta = Number.isNaN(tolerance) ? 0 : Math.abs(tolerance);
      return Math.abs(target - actual) <= delta;
    }
    case "fill_blank": {
      const expectedParts = splitQuestionCompoundAnswer(expected);
      const studentParts = splitQuestionCompoundAnswer(student);
      if (expectedParts.length === 0 || expectedParts.length !== studentParts.length) return false;
      return expectedParts.every(
        (part, index) => part.toLowerCase() === studentParts[index].toLowerCase(),
      );
    }
    case "matching": {
      const expectedRights = splitQuestionCompoundAnswer(expected);
      const studentRights = splitQuestionCompoundAnswer(student);
      if (expectedRights.length === 0 || expectedRights.length !== studentRights.length)
        return false;
      return expectedRights.every(
        (part, index) => part.toLowerCase() === studentRights[index].toLowerCase(),
      );
    }
    case "ordering": {
      const expectedOrder = splitQuestionCompoundAnswer(expected);
      const studentOrder = splitQuestionCompoundAnswer(student);
      if (expectedOrder.length === 0 || expectedOrder.length !== studentOrder.length) return false;
      return expectedOrder.every((item, index) => item === studentOrder[index]);
    }
    default:
      return student === expected;
  }
}

/** Normalizes type-specific options/answer before save. */
export function normalizeQuestionTypePayload(
  raw: Pick<QuestionBankQuestion, "type" | "text" | "options" | "answer">,
): Pick<QuestionBankQuestion, "options" | "answer"> {
  switch (raw.type) {
    case "ordering": {
      const items = raw.options.map((item) => item.trim()).filter(Boolean);
      return {
        options: items,
        answer: joinQuestionCompoundAnswer(items),
      };
    }
    case "matching": {
      const lefts = raw.options.map((item) => item.trim()).filter(Boolean);
      const rights = splitQuestionCompoundAnswer(raw.answer);
      const size = Math.max(lefts.length, rights.length);
      const normalizedLefts: string[] = [];
      const normalizedRights: string[] = [];
      for (let i = 0; i < size; i += 1) {
        const left = lefts[i]?.trim() ?? "";
        const right = rights[i]?.trim() ?? "";
        if (!left && !right) continue;
        normalizedLefts.push(left);
        normalizedRights.push(right);
      }
      return {
        options: normalizedLefts,
        answer: joinQuestionCompoundAnswer(normalizedRights),
      };
    }
    case "fill_blank":
      return {
        options: [],
        answer: joinQuestionCompoundAnswer(splitQuestionCompoundAnswer(raw.answer)),
      };
    case "numeric":
      return {
        options: raw.options?.[0]?.trim() ? [String(raw.options[0]).trim()] : [],
        answer: String(raw.answer ?? "").trim(),
      };
    default:
      return {
        options: Array.isArray(raw.options) ? raw.options : [],
        answer: String(raw.answer ?? ""),
      };
  }
}
