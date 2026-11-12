/**
 * @file questionInvariants.ts
 * @description Pure per-type invariant checks for Question Bank questions.
 *
 * This is the single authority for "is this question well-formed": the browser form resolver, the
 * backend write boundary and the tests all call `validateQuestionByType`, so a rule cannot drift
 * between the UI and the API. Domain only: no I/O, no tenant context.
 *
 * The rule map is exhaustive over `QuestionType`, so adding a new question type is a type error
 * until its invariants are written down. "Multiple response" is deliberately not a type: the stored
 * `answer` is a single value, which is what makes "exactly one correct option" structural for MCQ
 * rather than a convention.
 */
import type { AppTranslationKey } from "../i18n/appTranslations.js";
import {
  countFillBlankMarkers,
  joinQuestionCompoundAnswer,
  splitQuestionCompoundAnswer,
  type QuestionType,
} from "./questionBankCore.js";

export type QuestionInvariantCode =
  | "text_required"
  | "category_required"
  | "marks_positive"
  | "option_count"
  | "duplicate_options"
  | "answer_required"
  | "answer_not_in_options"
  | "true_false_required"
  | "true_false_options"
  | "option_not_allowed"
  | "blank_markers"
  | "blank_answer_count"
  | "numeric_answer"
  | "numeric_tolerance"
  | "matching_pairs"
  | "matching_incomplete"
  | "ordering_items"
  | "ordering_answer";

export interface QuestionInvariantIssue {
  /** Field path inside the record, e.g. `["answer"]` or `["options", 2]`. */
  path: (string | number)[];
  code: QuestionInvariantCode;
  /** Translation key shared by the form and the API error payload. */
  messageKey: AppTranslationKey;
}

/** The subset of a question the invariants read. Unknown fields are ignored. */
export interface QuestionInvariantInput {
  type: QuestionType;
  text?: string | null;
  options?: readonly string[] | null;
  answer?: string | null;
  marks?: number | null;
  categoryIds?: readonly string[] | null;
}

function trimmedOptions(input: QuestionInvariantInput): string[] {
  return (input.options ?? []).map((option) => option.trim());
}

function findDuplicate(values: readonly string[]): number | null {
  const seen = new Set<string>();
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index].toLowerCase();
    if (!key) continue;
    if (seen.has(key)) return index;
    seen.add(key);
  }
  return null;
}

/** Every invariant violation for one question, in field order. */
export function validateQuestionByType(input: QuestionInvariantInput): QuestionInvariantIssue[] {
  const issues: QuestionInvariantIssue[] = [];
  const push = (path: (string | number)[], code: QuestionInvariantCode) =>
    issues.push({ path, code, messageKey: INVARIANT_MESSAGE_KEYS[code] });

  if (!input.text || input.text.trim().length === 0) push(["text"], "text_required");

  if (input.categoryIds !== undefined) {
    const categories = (input.categoryIds ?? []).map((id) => id.trim()).filter(Boolean);
    if (new Set(categories).size === 0) push(["categoryIds"], "category_required");
  }

  if (input.marks !== undefined && input.marks !== null) {
    if (!Number.isInteger(input.marks) || input.marks < 1) push(["marks"], "marks_positive");
  }

  const options = trimmedOptions(input);
  const answer = (input.answer ?? "").trim();

  switch (input.type) {
    case "mcq": {
      if (options.length < 2) push(["options"], "option_count");
      const duplicate = findDuplicate(options);
      if (duplicate !== null) push(["options", duplicate], "duplicate_options");
      if (!answer) push(["answer"], "answer_required");
      else if (!options.includes(answer)) push(["answer"], "answer_not_in_options");
      break;
    }
    case "true_false": {
      if (options.length !== 2 || options.some((option) => !option)) {
        push(["options"], "true_false_options");
      }
      if (!answer) push(["answer"], "true_false_required");
      else if (!options.includes(answer)) push(["answer"], "answer_not_in_options");
      break;
    }
    case "short": {
      if (options.length > 0) push(["options"], "option_not_allowed");
      if (!answer) push(["answer"], "answer_required");
      break;
    }
    case "fill_blank": {
      if (options.length > 0) push(["options"], "option_not_allowed");
      const markers = countFillBlankMarkers(input.text ?? "");
      if (markers < 1) push(["text"], "blank_markers");
      const parts = splitQuestionCompoundAnswer(answer);
      if (parts.length !== markers) push(["answer"], "blank_answer_count");
      break;
    }
    case "numeric": {
      if (options.length > 1) push(["options"], "option_not_allowed");
      if (!answer || !Number.isFinite(Number(answer))) push(["answer"], "numeric_answer");
      const tolerance = options[0];
      if (tolerance) {
        const parsed = Number(tolerance);
        if (!Number.isFinite(parsed) || parsed < 0) push(["options", 0], "numeric_tolerance");
      }
      break;
    }
    case "matching": {
      if (options.length < 2) push(["options"], "matching_pairs");
      const duplicateLeft = findDuplicate(options);
      if (duplicateLeft !== null) push(["options", duplicateLeft], "duplicate_options");
      const rights = splitQuestionCompoundAnswer(answer);
      const duplicateRight = findDuplicate(rights);
      if (duplicateRight !== null) push(["answer"], "duplicate_options");
      if (options.length === 0 || rights.length !== options.length) {
        push(["answer"], "matching_incomplete");
      }
      break;
    }
    case "ordering": {
      if (options.length < 2) push(["options"], "ordering_items");
      const duplicate = findDuplicate(options);
      if (duplicate !== null) push(["options", duplicate], "duplicate_options");
      if (answer !== joinQuestionCompoundAnswer(options)) push(["answer"], "ordering_answer");
      break;
    }
    default: {
      // Exhaustiveness: a new QuestionType must add its rules here before it can be saved.
      const never: never = input.type;
      void never;
    }
  }

  return issues;
}

/** The translation key reported for each invariant code. */
export const INVARIANT_MESSAGE_KEYS: Readonly<Record<QuestionInvariantCode, AppTranslationKey>> = {
  text_required: "questionBank.validation.textRequired",
  category_required: "questionBank.validation.categoryRequired",
  marks_positive: "questionBank.validation.marksPositive",
  option_count: "questionBank.validation.optionCount",
  duplicate_options: "questionBank.validation.duplicateOptions",
  answer_required: "questionBank.validation.answerRequired",
  answer_not_in_options: "questionBank.validation.answerFromChoices",
  true_false_required: "questionBank.validation.trueFalseRequired",
  true_false_options: "questionBank.validation.trueFalseOptions",
  option_not_allowed: "questionBank.validation.optionNotAllowed",
  blank_markers: "questionBank.validation.blankMarkers",
  blank_answer_count: "questionBank.validation.blankAnswerCount",
  numeric_answer: "questionBank.validation.numericAnswer",
  numeric_tolerance: "questionBank.validation.numericTolerance",
  matching_pairs: "questionBank.validation.matchingPairs",
  matching_incomplete: "questionBank.validation.matchingIncomplete",
  ordering_items: "questionBank.validation.orderingItems",
  ordering_answer: "questionBank.validation.orderingAnswer",
};

/** Convenience: the first issue, or `null` when the question is valid. */
export function firstQuestionInvariantIssue(
  input: QuestionInvariantInput,
): QuestionInvariantIssue | null {
  return validateQuestionByType(input)[0] ?? null;
}
