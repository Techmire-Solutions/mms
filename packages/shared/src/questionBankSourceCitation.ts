import type { AppTranslationKey } from "./appTranslations.js";
import type { QuestionSourceBook, QuestionSourceReference } from "./questionBankEntities.js";
import { getQuestionSources, type QuestionSourceRef } from "./questionBankSourceNormalize.js";

/** Translation function accepted by source citation formatters. */
export type QuestionSourceCitationTranslator = (
  key: AppTranslationKey,
  params?: Record<string, string | number>,
) => string;

/** Joins multiple source citations for list display. */
export function formatQuestionSourcesCitation(
  question: QuestionSourceRef,
  t: QuestionSourceCitationTranslator,
  books?: readonly QuestionSourceBook[] | ReadonlyMap<string, QuestionSourceBook>,
): string | null {
  const entries = getQuestionSources(question, books);
  const lines = entries
    .map((entry) => formatQuestionSourceCitation(entry, t))
    .filter((line): line is string => !!line);
  return lines.length > 0 ? lines.join(" | ") : null;
}

/** Builds a compact citation line from populated source reference parts. */
export function formatQuestionSourceCitation(
  source: QuestionSourceReference | undefined,
  t: QuestionSourceCitationTranslator,
): string | null {
  if (!source) return null;
  const parts: string[] = [];
  if (source.bookName) parts.push(source.bookName);
  if (source.series) {
    parts.push(t("questionBank.source.citationSeries", { series: source.series }));
  }
  if (source.hadithCollection) parts.push(source.hadithCollection);
  if (source.author) parts.push(source.author);
  if (source.editor) {
    parts.push(t("questionBank.source.citationEditor", { editor: source.editor }));
  }
  if (source.translator) {
    parts.push(t("questionBank.source.citationTranslator", { translator: source.translator }));
  }
  if (source.bookVolume) {
    parts.push(t("questionBank.source.citationVol", { volume: source.bookVolume }));
  }
  if (source.volumePart) {
    parts.push(t("questionBank.source.citationPart", { part: source.volumePart }));
  }
  if (source.edition) {
    parts.push(t("questionBank.source.citationEdition", { edition: source.edition }));
  }
  if (source.chapter) {
    parts.push(t("questionBank.source.citationChapter", { chapter: source.chapter }));
  }
  if (source.surah) {
    parts.push(t("questionBank.source.citationSurah", { surah: source.surah }));
  }
  if (source.ayah) {
    parts.push(t("questionBank.source.citationAyah", { ayah: source.ayah }));
  }
  if (source.juz) {
    parts.push(t("questionBank.source.citationJuz", { juz: source.juz }));
  }
  if (source.hizb) {
    parts.push(t("questionBank.source.citationHizb", { hizb: source.hizb }));
  }
  if (source.pageNumber) {
    parts.push(t("questionBank.source.citationPage", { page: source.pageNumber }));
  }
  if (source.paragraph) {
    parts.push(t("questionBank.source.citationParagraph", { paragraph: source.paragraph }));
  }
  if (source.footnote) {
    parts.push(t("questionBank.source.citationFootnote", { footnote: source.footnote }));
  }
  if (source.hadithNumber) {
    parts.push(t("questionBank.source.citationHadith", { number: source.hadithNumber }));
  }
  if (source.manuscript) {
    parts.push(t("questionBank.source.citationManuscript", { manuscript: source.manuscript }));
  }
  if (source.catalogNumber) {
    parts.push(t("questionBank.source.citationCatalog", { catalog: source.catalogNumber }));
  }
  if (source.isbn) {
    parts.push(t("questionBank.source.citationIsbn", { isbn: source.isbn }));
  }
  if (source.publisher) parts.push(source.publisher);
  if (source.cityOfPublication) parts.push(source.cityOfPublication);
  if (source.publishDate) parts.push(source.publishDate);
  if (source.yearHijri) {
    parts.push(t("questionBank.source.citationYearHijri", { year: source.yearHijri }));
  }
  if (source.language) {
    parts.push(t("questionBank.source.citationLanguage", { language: source.language }));
  }
  if (source.quote) {
    parts.push(t("questionBank.source.citationQuote", { quote: source.quote }));
  }
  if (source.notes) parts.push(source.notes);
  return parts.length > 0 ? parts.join(" · ") : null;
}
