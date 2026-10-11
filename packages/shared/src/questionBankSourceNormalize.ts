import { normalizeAppLanguage } from "./languageUtils.js";
import { normalizeQuestionTypePayload } from "./questionBankAnswerUtils.js";
import { getQuestionCategoryIds } from "./questionBankCategoryUtils.js";
import type { QuestionDifficulty, QuestionType } from "./questionBankCore.js";
import type {
  QuestionBankQuestion,
  QuestionBookCitation,
  QuestionSourceBook,
  QuestionSourceReference,
} from "./questionBankEntities.js";

/** Question shape accepted by source merge helpers. */
export type QuestionSourceRef = {
  sourceCitations?: QuestionBookCitation[];
  sources?: QuestionSourceReference[];
  source?: QuestionSourceReference;
};

/** Drops empty source values; returns `undefined` when nothing is set. */
export function compactQuestionSource(
  source?: QuestionSourceReference | null,
): QuestionSourceReference | undefined {
  if (!source) return undefined;
  const compactSource: QuestionSourceReference = {};
  for (const [key, value] of Object.entries(source)) {
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (trimmed) {
      (compactSource as Record<string, string>)[key] = trimmed;
    }
  }
  return Object.keys(compactSource).length > 0 ? compactSource : undefined;
}

function lookupBook(
  books: readonly QuestionSourceBook[] | ReadonlyMap<string, QuestionSourceBook>,
  bookId: string,
): QuestionSourceBook | undefined {
  if ("get" in books && typeof books.get === "function") {
    return books.get(bookId);
  }
  return (books as readonly QuestionSourceBook[]).find((entry) => entry.id === bookId);
}

/** Merges book metadata with a per-question citation. */
export function resolveQuestionBookCitation(
  citation: QuestionBookCitation,
  books: readonly QuestionSourceBook[] | ReadonlyMap<string, QuestionSourceBook>,
): QuestionSourceReference | undefined {
  const book = lookupBook(books, citation.bookId);
  if (!book) return compactQuestionSource(citation.citation as QuestionSourceReference);
  return compactQuestionSource({
    ...book.metadata,
    bookName: book.metadata.bookName ?? book.name,
    ...citation.citation,
  });
}

/** Compacts stored book citations; returns `undefined` when empty. */
export function compactQuestionBookCitations(
  citations?: QuestionBookCitation[] | null,
): QuestionBookCitation[] | undefined {
  const compacted = (citations ?? [])
    .filter((entry) => entry.bookId?.trim())
    .map((entry) => ({
      bookId: entry.bookId.trim(),
      citation: compactQuestionSource(entry.citation as QuestionSourceReference) ?? {},
    }));
  return compacted.length > 0 ? compacted : undefined;
}

/** Resolves source entries from citations, `sources`, or legacy `source`. */
export function getQuestionSources(
  question: QuestionSourceRef,
  books?: readonly QuestionSourceBook[] | ReadonlyMap<string, QuestionSourceBook>,
): QuestionSourceReference[] {
  let bookLookup: readonly QuestionSourceBook[] | ReadonlyMap<string, QuestionSourceBook>;
  if (!books) {
    bookLookup = [];
  } else if ("get" in books) {
    bookLookup = books;
  } else if (books.length > 3) {
    bookLookup = new Map(books.map((b) => [b.id, b]));
  } else {
    bookLookup = books;
  }
  const fromCitations = (question.sourceCitations ?? [])
    .map((entry) => resolveQuestionBookCitation(entry, bookLookup))
    .filter((entry): entry is QuestionSourceReference => !!entry);
  if (fromCitations.length > 0) return fromCitations;

  const fromArray = (question.sources ?? [])
    .map((entry) => compactQuestionSource(entry))
    .filter((entry): entry is QuestionSourceReference => !!entry);
  if (fromArray.length > 0) return fromArray;
  const legacy = compactQuestionSource(question.source);
  return legacy ? [legacy] : [];
}

/** Resolves per-question citations in the current storage format. */
export function getQuestionBookCitations(question: QuestionSourceRef): QuestionBookCitation[] {
  if (Array.isArray(question.sourceCitations) && question.sourceCitations.length > 0) {
    return question.sourceCitations.filter((entry) => entry.bookId?.trim());
  }
  return [];
}

/** Compacts source entries; returns `undefined` when empty. */
export function compactQuestionSources(
  sources?: QuestionSourceReference[] | null,
): QuestionSourceReference[] | undefined {
  const compacted = (sources ?? [])
    .map((entry) => compactQuestionSource(entry))
    .filter((entry): entry is QuestionSourceReference => !!entry);
  return compacted.length > 0 ? compacted : undefined;
}

/** Normalizes legacy category and source fields into current storage arrays. */
export function normalizeQuestionBankQuestion(
  raw: Partial<QuestionBankQuestion> | QuestionBankQuestion,
): QuestionBankQuestion {
  const categoryIds = getQuestionCategoryIds(raw);
  const compactedCitations = compactQuestionBookCitations(
    raw.sourceCitations as QuestionBookCitation[] | undefined,
  );
  const compactedSources = compactQuestionSources(getQuestionSources(raw));
  const type = (raw.type as QuestionType) ?? "mcq";
  const typePayload = normalizeQuestionTypePayload({
    type,
    text: String(raw.text ?? ""),
    options: Array.isArray(raw.options) ? (raw.options as string[]) : [],
    answer: String(raw.answer ?? ""),
  });
  return {
    ...raw,
    id: String(raw.id ?? ""),
    categoryIds,
    categoryId: categoryIds[0] ?? "",
    type,
    difficulty: (raw.difficulty as QuestionDifficulty) ?? "easy",
    questionLanguage: normalizeAppLanguage(raw.questionLanguage as string | undefined),
    text: String(raw.text ?? ""),
    options: typePayload.options,
    answer: typePayload.answer,
    marks:
      raw.marks === undefined || raw.marks === null
        ? 1
        : typeof raw.marks === "number"
          ? raw.marks
          : Number(raw.marks) || 1,
    tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : undefined,
    sourceCitations: compactedCitations,
    sources: compactedSources,
    source: compactedSources?.[0],
  } as QuestionBankQuestion;
}
