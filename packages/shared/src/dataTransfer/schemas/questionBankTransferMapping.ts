import type { QuestionBankQuestion } from "../../examinations/questionBankEntityTypes.js";
import type { QuestionBookCitation } from "../../examinations/questionBankSourceFields.js";
import type { QuestionDifficulty, QuestionType } from "../../examinations/questionBankCore.js";
import type { QuestionBankTransferEntity } from "./questionBankTransferSchema.js";

/**
 * Symmetric mapping between stored questions and the CSV transfer row.
 *
 * The import row is deliberately not the storage shape (`title/category/points/explanation` and
 * free-text `difficulty`/`type`). Mapping through one pure function keeps export → import
 * round-trippable and makes every normalisation rule testable without a queue or a database.
 */

/** Aliases accepted for `difficulty`; unknown values default to `medium`. */
const DIFFICULTY_ALIASES: Record<string, QuestionDifficulty> = {
  beginner: "easy",
  basic: "easy",
  easy: "easy",
  "lower-intermediate": "medium",
  intermediate: "medium",
  medium: "medium",
  moderate: "medium",
  advanced: "hard",
  difficult: "hard",
  hard: "hard",
  expert: "hard",
};

/**
 * Types the CSV can represent. `mcq` uses the pipe-separated `options` column and `true_false` its
 * two fixed choices; pair/order types stay with the authoring form because a flat row cannot carry
 * matched pairs.
 */
const TYPE_ALIASES: Record<string, QuestionType> = {
  text: "short",
  "open-ended": "short",
  openended: "short",
  open_ended: "short",
  short: "short",
  "short-answer": "short",
  short_answer: "short",
  descriptive: "short",
  essay: "short",
  mcq: "mcq",
  "multiple-choice": "mcq",
  multiple_choice: "mcq",
  multiplechoice: "mcq",
  choice: "mcq",
  true_false: "true_false",
  "true-false": "true_false",
  truefalse: "true_false",
  tf: "true_false",
  numeric: "numeric",
  number: "numeric",
  fill: "fill_blank",
  fill_blank: "fill_blank",
  "fill-in-the-blank": "fill_blank",
  fill_in_the_blank: "fill_blank",
  blanks: "fill_blank",
};

/** A flat transfer row cannot express matched pairs or a full ordering. */
const PAIR_TYPES = new Set(["matching", "match", "ordering", "order", "sequence"]);

/** A validated, storage-shaped question ready for id/status assignment by the import job. */
export interface QuestionImportCandidate {
  text: string;
  categoryIds: string[];
  difficulty: QuestionDifficulty;
  type: QuestionType;
  questionLanguage: "en";
  options: string[];
  answer: string;
  marks: number;
  sourceCitations: QuestionBookCitation[];
}

/**
 * The CSV row as the shared import schema produces it (`points` may be a string from the file), so it
 * is not interchangeable with the exported entity where `points` is a number.
 */
export interface QuestionTransferRow {
  title?: string;
  category?: string;
  difficulty?: string;
  type?: string;
  options?: string;
  points?: string | number;
  explanation?: string;
  source?: string;
  status?: string;
  notes?: string;
}

export type QuestionImportMapping =
  { ok: true; value: QuestionImportCandidate } | { ok: false; reason: string };

function normalised(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

/** Storage → CSV row (used by the export runner). */
export function questionToTransferEntity(
  question: QuestionBankQuestion,
): QuestionBankTransferEntity {
  return {
    title: question.text,
    category: question.categoryIds[0] ?? "",
    difficulty: question.difficulty,
    type: question.type,
    options: question.options.join(" | "),
    points: question.marks ?? 1,
    explanation: question.answer,
    source: question.sourceCitations?.[0]?.citation.bookName ?? "",
    status: question.status ?? "draft",
    notes: "",
  };
}

/** Pipe-separated choices; blank cells and empty segments are dropped. */
function parseOptions(raw: unknown): string[] {
  return text(raw)
    .split("|")
    .map((option) => option.trim())
    .filter(Boolean);
}

/** Marks are positive integers; a blank cell means the default (1). */
function parseMarks(raw: unknown): { ok: true; marks: number } | { ok: false; reason: string } {
  const value = text(raw);
  if (!value) return { ok: true, marks: 1 };
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    return { ok: false, reason: "points must be a positive integer" };
  }
  return { ok: true, marks: parsed };
}

/**
 * CSV row → storage candidate.
 *
 * `status` is deliberately ignored: imports always land as drafts so bulk CSV cannot bypass the
 * approver gate (an author holds `questionBank.write`, not `questionBank.delete`).
 */
export function transferRowToQuestionInput(row: QuestionTransferRow): QuestionImportMapping {
  const stem = text(row.title);
  if (!stem) return { ok: false, reason: "title (question stem) is required" };

  const category = text(row.category);
  if (!category) return { ok: false, reason: "category is required" };

  const rawType = normalised(row.type) || "short";
  if (PAIR_TYPES.has(rawType)) {
    return {
      ok: false,
      reason: `${rawType} questions need the authoring form (the CSV carries no pairs)`,
    };
  }
  const type = TYPE_ALIASES[rawType];
  if (!type) return { ok: false, reason: `unsupported question type "${text(row.type)}"` };

  let answer = text(row.explanation);
  if (!answer) return { ok: false, reason: "explanation (answer key) is required" };

  const parsedOptions = parseOptions(row.options);
  if (type === "mcq") {
    if (parsedOptions.length < 2) {
      return {
        ok: false,
        reason: "mcq rows need at least two options separated by |",
      };
    }
    const correct = parsedOptions.find((option) => option.toLowerCase() === answer.toLowerCase());
    if (!correct) {
      return {
        ok: false,
        reason: "the explanation must match one of the options for mcq",
      };
    }
    answer = correct;
  }
  if (type === "true_false") {
    const bool = answer.toLowerCase();
    if (bool !== "true" && bool !== "false") {
      return { ok: false, reason: 'true_false answer must be "true" or "false"' };
    }
    answer = bool;
  }

  if (type === "fill_blank" && !/_{2,}/.test(stem)) {
    return { ok: false, reason: "fill-in-the-blank stems need at least two underscores (____)" };
  }

  const marks = parseMarks(row.points);
  if (!marks.ok) return { ok: false, reason: marks.reason };

  const difficulty = DIFFICULTY_ALIASES[normalised(row.difficulty)] ?? "medium";
  const source = text(row.source);
  const sourceCitations: QuestionBookCitation[] = source
    ? [{ bookId: "csv-import", citation: { bookName: source } }]
    : [];

  return {
    ok: true,
    value: {
      text: stem,
      categoryIds: [category],
      difficulty,
      type,
      questionLanguage: "en",
      options: type === "mcq" ? parsedOptions : [],
      answer,
      marks: marks.marks,
      sourceCitations,
    },
  };
}
