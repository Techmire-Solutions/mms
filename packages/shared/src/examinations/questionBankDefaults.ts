import type {
  QuestionBankQuestion,
  QuestionBankResult,
  QuestionBankTest,
} from "./questionBankEntities.js";

/** New workspaces start with an empty question bank. */
export const DEFAULT_QUESTION_BANK_QUESTIONS: QuestionBankQuestion[] = [];
export const DEFAULT_QUESTION_BANK_TESTS: QuestionBankTest[] = [];
export const DEFAULT_QUESTION_BANK_RESULTS: QuestionBankResult[] = [];
