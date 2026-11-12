import type { QuestionBankQuestion } from "./questionBankEntityTypes.js";
import { validateQuestionByType } from "./questionInvariants.js";

/**
 * Discriminated read view of a stored question.
 *
 * The wire/storage record is flat (`options: string[]`, `answer: string`) because legacy rows and the
 * bulk read endpoints must stay readable. This union refines that record by its `type` discriminant so
 * consumers get compile-time narrowing (`question.options` is a two-tuple on an MCQ) and a single
 * runtime entry point, `toQuestionDto`, that refuses rows which violate the per-type invariants.
 */

export type McqQuestion = QuestionBankQuestion & {
  type: "mcq";
  options: [string, string, ...string[]];
};

/** True/False stores the two localized labels; `answer` is the chosen label. */
export type TrueFalseQuestion = QuestionBankQuestion & {
  type: "true_false";
  options: [string, string];
};

export type ShortAnswerQuestion = QuestionBankQuestion & {
  type: "short" | "fill_blank" | "numeric";
  options: [];
};

export type StructuredQuestion = QuestionBankQuestion & {
  type: "matching" | "ordering";
};

export type QuestionDto =
  McqQuestion | TrueFalseQuestion | ShortAnswerQuestion | StructuredQuestion;

/**
 * Narrows a stored record to the discriminated view, or returns null when it violates the
 * per-type invariants (dirty legacy data must not reach a consumer that assumes the shape).
 */
export function toQuestionDto(record: QuestionBankQuestion): QuestionDto | null {
  if (validateQuestionByType(record).length > 0) return null;
  switch (record.type) {
    case "mcq":
      return record.options.length >= 2 ? (record as McqQuestion) : null;
    case "true_false":
      return record.options.length === 2 ? (record as TrueFalseQuestion) : null;
    case "short":
    case "fill_blank":
    case "numeric":
      return record.options.length === 0 ? (record as ShortAnswerQuestion) : null;
    case "matching":
    case "ordering":
      return record as StructuredQuestion;
    default:
      return null;
  }
}

export function isMcqQuestion(question: QuestionBankQuestion): question is McqQuestion {
  return question.type === "mcq" && question.options.length >= 2;
}

export function isTrueFalseQuestion(question: QuestionBankQuestion): question is TrueFalseQuestion {
  return question.type === "true_false" && question.options.length === 2;
}

export function isShortAnswerQuestion(
  question: QuestionBankQuestion,
): question is ShortAnswerQuestion {
  return (
    (question.type === "short" || question.type === "fill_blank" || question.type === "numeric") &&
    question.options.length === 0
  );
}

export function isStructuredQuestion(
  question: QuestionBankQuestion,
): question is StructuredQuestion {
  return question.type === "matching" || question.type === "ordering";
}
