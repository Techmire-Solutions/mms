/** Bibliographic / source reference stored on a question (book, volume, page, etc.). */
export interface QuestionSourceReference {
  bookName?: string;
  series?: string;
  bookVolume?: string;
  volumePart?: string;
  edition?: string;
  isbn?: string;
  author?: string;
  editor?: string;
  translator?: string;
  publisher?: string;
  cityOfPublication?: string;
  publishDate?: string;
  yearHijri?: string;
  language?: string;
  chapter?: string;
  pageNumber?: string;
  paragraph?: string;
  footnote?: string;
  surah?: string;
  ayah?: string;
  juz?: string;
  hizb?: string;
  hadithCollection?: string;
  hadithNumber?: string;
  manuscript?: string;
  catalogNumber?: string;
  quote?: string;
  notes?: string;
}

/** System field ids for source reference sub-fields (Setup → Fields). */
export const QUESTION_SOURCE_FIELD_IDS = [
  "sourceBookName",
  "sourceSeries",
  "sourceBookVolume",
  "sourceVolumePart",
  "sourceEdition",
  "sourceIsbn",
  "sourceAuthor",
  "sourceEditor",
  "sourceTranslator",
  "sourcePublisher",
  "sourceCityOfPublication",
  "sourcePublishDate",
  "sourceYearHijri",
  "sourceLanguage",
  "sourceChapter",
  "sourcePageNumber",
  "sourceParagraph",
  "sourceFootnote",
  "sourceSurah",
  "sourceAyah",
  "sourceJuz",
  "sourceHizb",
  "sourceHadithCollection",
  "sourceHadithNumber",
  "sourceManuscript",
  "sourceCatalogNumber",
  "sourceQuote",
  "sourceNotes",
] as const;

export type QuestionSourceFieldId = (typeof QUESTION_SOURCE_FIELD_IDS)[number];

/** Maps source field registry ids to `QuestionSourceReference` keys. */
export const QUESTION_SOURCE_FIELD_TO_KEY: Record<
  QuestionSourceFieldId,
  keyof QuestionSourceReference
> = {
  sourceBookName: "bookName",
  sourceSeries: "series",
  sourceBookVolume: "bookVolume",
  sourceVolumePart: "volumePart",
  sourceEdition: "edition",
  sourceIsbn: "isbn",
  sourceAuthor: "author",
  sourceEditor: "editor",
  sourceTranslator: "translator",
  sourcePublisher: "publisher",
  sourceCityOfPublication: "cityOfPublication",
  sourcePublishDate: "publishDate",
  sourceYearHijri: "yearHijri",
  sourceLanguage: "language",
  sourceChapter: "chapter",
  sourcePageNumber: "pageNumber",
  sourceParagraph: "paragraph",
  sourceFootnote: "footnote",
  sourceSurah: "surah",
  sourceAyah: "ayah",
  sourceJuz: "juz",
  sourceHizb: "hizb",
  sourceHadithCollection: "hadithCollection",
  sourceHadithNumber: "hadithNumber",
  sourceManuscript: "manuscript",
  sourceCatalogNumber: "catalogNumber",
  sourceQuote: "quote",
  sourceNotes: "notes",
};

const QUESTION_SOURCE_FIELD_IDS_SET = new Set<string>(QUESTION_SOURCE_FIELD_IDS);

/** Returns whether a field id belongs to the source reference group. */
export function isQuestionSourceFieldId(fieldId: string): fieldId is QuestionSourceFieldId {
  return QUESTION_SOURCE_FIELD_IDS_SET.has(fieldId);
}

/** Add-question form / fields-settings tab ids (Categories | Question | Sources). */
export const QUESTION_SOURCE_BOOK_FIELD_IDS: readonly QuestionSourceFieldId[] = [
  "sourceBookName",
  "sourceSeries",
  "sourceBookVolume",
  "sourceEdition",
  "sourceIsbn",
  "sourceAuthor",
  "sourceEditor",
  "sourceTranslator",
  "sourcePublisher",
  "sourceCityOfPublication",
  "sourcePublishDate",
  "sourceYearHijri",
  "sourceLanguage",
  "sourceHadithCollection",
  "sourceManuscript",
  "sourceCatalogNumber",
];

/** Fields filled per question when citing a registered book. */
export const QUESTION_SOURCE_CITATION_FIELD_IDS: readonly QuestionSourceFieldId[] = [
  "sourceVolumePart",
  "sourceChapter",
  "sourcePageNumber",
  "sourceParagraph",
  "sourceFootnote",
  "sourceSurah",
  "sourceAyah",
  "sourceJuz",
  "sourceHizb",
  "sourceHadithNumber",
  "sourceQuote",
  "sourceNotes",
];

/** Registered bibliographic source book — defined once, reused via dropdown. */
export interface QuestionSourceBook {
  id: string;
  name: string;
  /** Source field ids that apply to this book (from global registry). */
  fieldIds: QuestionSourceFieldId[];
  /** Book-level metadata (author, publisher, etc.). */
  metadata: QuestionSourceReference;
}

/** Per-question citation pointing at a registered book plus location details. */
export interface QuestionBookCitation {
  bookId: string;
  citation: Partial<QuestionSourceReference>;
}
