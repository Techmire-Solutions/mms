import { APP_LANGUAGES, type AppLanguageCode } from "./languageUtils.js";

/** Supported question content languages (matches app UI languages). */
export const QUESTION_LANGUAGE_IDS = APP_LANGUAGES.map((lang) => lang.code);
export type QuestionLanguageCode = AppLanguageCode;

/** Question difficulty levels for the question bank. */
export type QuestionDifficulty = "easy" | "medium" | "hard";

/** Supported question formats. */
export type QuestionType =
  "mcq" | "true_false" | "short" | "fill_blank" | "matching" | "numeric" | "ordering";

/** Registry ids for difficulty — labels via `questionBank.difficulty.*` i18n keys. */
export const QUESTION_DIFFICULTY_IDS = ["easy", "medium", "hard"] as const;

/** Registry ids for question types — labels via `questionBank.type.*` i18n keys. */
export const QUESTION_TYPE_IDS = [
  "mcq",
  "true_false",
  "short",
  "fill_blank",
  "matching",
  "numeric",
  "ordering",
] as const;

/** Placeholder in question text for each blank (`fill_blank`). */
export const FILL_BLANK_MARKER = "___";

/** Delimiter for multi-part stored answers (blanks, matching rights, ordering). */
export const QUESTION_COMPOUND_ANSWER_DELIMITER = "|||";

/** Tailwind badge classes keyed by difficulty id (labels via i18n). Uses semantic tokens. */
export const QUESTION_DIFFICULTY_BADGE_CLASSES: Record<QuestionDifficulty, string> = {
  easy: "bg-success/10 text-success border-success/20",
  medium: "bg-warning/10 text-warning border-warning/20",
  hard: "bg-destructive/10 text-destructive border-destructive/20",
};

/** Display icons keyed by question type id (labels via i18n). */
export const QUESTION_TYPE_ICONS: Record<QuestionType, string> = {
  mcq: "◉",
  true_false: "⊙",
  short: "✎",
  fill_blank: "▢",
  matching: "⇄",
  numeric: "#",
  ordering: "↕",
};

/** Splits compound answers stored on a question. */
export function splitQuestionCompoundAnswer(answer: string): string[] {
  return answer
    .split(QUESTION_COMPOUND_ANSWER_DELIMITER)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Joins compound answer parts for storage. */
export function joinQuestionCompoundAnswer(parts: readonly string[]): string {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(QUESTION_COMPOUND_ANSWER_DELIMITER);
}

/** Counts blank markers in fill-in-the-blank question text. */
export function countFillBlankMarkers(text: string): number {
  const matches = text.match(/___/g);
  return matches?.length ?? 0;
}

/** Matching: `options` = left column; `answer` = right column (same order, compound). */

/** Analytics accuracy tier thresholds (percent). */
export const QUESTION_ACCURACY_WEAK_THRESHOLD = 60;
export const QUESTION_ACCURACY_GOOD_THRESHOLD = 75;
export const QUESTION_ACCURACY_EXCELLENT_THRESHOLD = 85;

/** Progress bar colour class for category accuracy tiers. */
export function questionAccuracyBarClass(accuracy: number): string {
  if (accuracy < QUESTION_ACCURACY_WEAK_THRESHOLD) return "bg-destructive";
  if (accuracy < QUESTION_ACCURACY_GOOD_THRESHOLD) return "bg-amber-500";
  return "bg-emerald-500";
}

/** Text colour class for category accuracy tiers. */
export function questionAccuracyTextClass(accuracy: number): string {
  if (accuracy < QUESTION_ACCURACY_WEAK_THRESHOLD) return "text-destructive";
  if (accuracy < QUESTION_ACCURACY_GOOD_THRESHOLD) return "text-amber-600";
  return "text-emerald-600";
}
