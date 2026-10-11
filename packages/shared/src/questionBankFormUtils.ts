import { translateAppParams, type AppTranslationKey } from "./appTranslations.js";
import { isQuestionSourceFieldId } from "./questionBankEntities.js";

export type QuestionBankFormTabId = "categories" | "question" | "sources";

export const QUESTION_BANK_FORM_TAB_ORDER: readonly QuestionBankFormTabId[] = [
  "categories",
  "question",
  "sources",
] as const;

const QUESTION_BANK_CATEGORIES_FIELD_IDS = new Set([
  "categoryId",
  "questionLanguage",
  "difficulty",
]);

/** Maps a question-bank field id to its form/settings tab. */
export function getQuestionBankFieldFormTab(fieldId: string): QuestionBankFormTabId {
  if (isQuestionSourceFieldId(fieldId)) return "sources";
  if (QUESTION_BANK_CATEGORIES_FIELD_IDS.has(fieldId)) return "categories";
  return "question";
}

/** Splits a stored field order into per-tab segments. */
export function partitionQuestionBankFieldOrder(
  fieldOrder: readonly string[],
): Record<QuestionBankFormTabId, string[]> {
  const buckets: Record<QuestionBankFormTabId, string[]> = {
    categories: [],
    question: [],
    sources: [],
  };
  for (const fieldId of fieldOrder) {
    buckets[getQuestionBankFieldFormTab(fieldId)].push(fieldId);
  }
  return buckets;
}

/** Replaces one tab segment after drag-reorder within that tab. */
export function mergeQuestionBankFieldOrder(
  fieldOrder: readonly string[],
  tabId: QuestionBankFormTabId,
  reorderedTabIds: readonly string[],
): string[] {
  const buckets = partitionQuestionBankFieldOrder(fieldOrder);
  buckets[tabId] = [...reorderedTabIds];
  return QUESTION_BANK_FORM_TAB_ORDER.flatMap((tab) => buckets[tab]);
}

/** Fields filled once when defining a source book in the registry. */
export const QUESTION_BANK_FIELD_LABEL_KEYS: Record<string, AppTranslationKey> = {
  text: "questionBank.questionText",
  categoryId: "questionBank.category",
  questionLanguage: "questionBank.questionLanguage",
  type: "questionBank.type",
  difficulty: "questionBank.difficulty",
  options: "questionBank.optionsLabel",
  answer: "questionBank.correctAnswer",
  sourceBookName: "questionBank.source.bookName",
  sourceSeries: "questionBank.source.series",
  sourceBookVolume: "questionBank.source.bookVolume",
  sourceVolumePart: "questionBank.source.volumePart",
  sourceEdition: "questionBank.source.edition",
  sourceIsbn: "questionBank.source.isbn",
  sourceAuthor: "questionBank.source.author",
  sourceEditor: "questionBank.source.editor",
  sourceTranslator: "questionBank.source.translator",
  sourcePublisher: "questionBank.source.publisher",
  sourceCityOfPublication: "questionBank.source.cityOfPublication",
  sourcePublishDate: "questionBank.source.publishDate",
  sourceYearHijri: "questionBank.source.yearHijri",
  sourceLanguage: "questionBank.source.language",
  sourceChapter: "questionBank.source.chapter",
  sourcePageNumber: "questionBank.source.pageNumber",
  sourceParagraph: "questionBank.source.paragraph",
  sourceFootnote: "questionBank.source.footnote",
  sourceSurah: "questionBank.source.surah",
  sourceAyah: "questionBank.source.ayah",
  sourceJuz: "questionBank.source.juz",
  sourceHizb: "questionBank.source.hizb",
  sourceHadithCollection: "questionBank.source.hadithCollection",
  sourceHadithNumber: "questionBank.source.hadithNumber",
  sourceManuscript: "questionBank.source.manuscript",
  sourceCatalogNumber: "questionBank.source.catalogNumber",
  sourceQuote: "questionBank.source.quote",
  sourceNotes: "questionBank.source.notes",
};

/** Localized "{field} is required" for question bank form validation. */
export function translateQuestionFieldRequired(
  fieldId: string,
  language: string,
  fallbackLabel?: string,
): string {
  const labelKey = QUESTION_BANK_FIELD_LABEL_KEYS[fieldId];
  const fieldName = labelKey ? translateAppParams(labelKey, language) : (fallbackLabel ?? fieldId);
  return translateAppParams("questionBank.fieldRequired", language, { field: fieldName });
}
