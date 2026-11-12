import { z } from "zod";
import { APP_LANGUAGES } from "../core/languageUtils.js";

/**
 * Single source of truth for the Question Bank taxonomies.
 *
 * The TS unions, the Zod enums, the registry id arrays and the database CHECK constraints (migration
 * 0243) all derive from — or are asserted against — these lists. Adding a question type is one edit
 * here plus the migration, not four independent declarations.
 */

/** Supported question formats. */
export const QUESTION_TYPES = [
  "mcq",
  "true_false",
  "short",
  "fill_blank",
  "matching",
  "numeric",
  "ordering",
] as const;

export const QUESTION_DIFFICULTIES = ["easy", "medium", "hard"] as const;

/** Content languages a question may be authored in (matches the app UI languages). */
export const QUESTION_LANGUAGES = ["en", "ar", "ur", "fa"] as const;

/** Authoring lifecycle values `questions.status` may hold (CHECK added by migration 0241). */
export const QUESTION_STATUSES = ["draft", "under_review", "approved", "retired"] as const;

export const questionTypeSchema = z.enum(QUESTION_TYPES);
export const questionDifficultySchema = z.enum(QUESTION_DIFFICULTIES);
export const questionLanguageSchema = z.enum(QUESTION_LANGUAGES);
export const questionStatusSchema = z.enum(QUESTION_STATUSES);

export type QuestionType = (typeof QUESTION_TYPES)[number];
export type QuestionDifficulty = (typeof QUESTION_DIFFICULTIES)[number];
export type QuestionLanguage = (typeof QUESTION_LANGUAGES)[number];
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

/** Runtime guard used by the taxonomy parity test. */
export function languagesMatchAppLanguages(): boolean {
  const appCodes = APP_LANGUAGES.map((language) => language.code);
  return (
    appCodes.length === QUESTION_LANGUAGES.length &&
    appCodes.every((code, index) => code === QUESTION_LANGUAGES[index])
  );
}
