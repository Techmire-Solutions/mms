import type { QuestionCategory } from "./questionBankEntityTypes.js";
import type { QuestionSourceBook } from "./questionBankSourceFields.js";

/** Palette for auto-assigned category colours. */
export const QUESTION_CATEGORY_COLORS: readonly string[] = [
  "#0d9488",
  "#7c3aed",
  "#b45309",
  "#0369a1",
  "#be185d",
  "#059669",
  "#d97706",
  "#dc2626",
  "#4f46e5",
  "#0891b2",
];

export const DEFAULT_QUESTION_SOURCE_BOOKS: QuestionSourceBook[] = [
  {
    id: "book-quran",
    name: "Quran",
    fieldIds: ["sourceBookName", "sourceSurah", "sourceAyah", "sourceJuz", "sourcePageNumber"],
    metadata: { bookName: "Quran" },
  },
  {
    id: "book-tafsir-ibn-kathir",
    name: "Tafsir Ibn Kathir",
    fieldIds: [
      "sourceBookName",
      "sourceAuthor",
      "sourcePublisher",
      "sourceSurah",
      "sourceAyah",
      "sourcePageNumber",
    ],
    metadata: {
      bookName: "Tafsir Ibn Kathir",
      author: "Ibn Kathir",
    },
  },
];

export const DEFAULT_QUESTION_CATEGORIES: QuestionCategory[] = [
  { id: "cat1", name: "Tajweed", icon: "📖", color: "#0d9488" },
  { id: "cat2", name: "Hifz", icon: "🕌", color: "#7c3aed" },
  { id: "cat3", name: "Islamic Studies", icon: "☪️", color: "#b45309" },
  { id: "cat4", name: "Arabic", icon: "✍️", color: "#0369a1" },
  { id: "cat5", name: "Aqeedah", icon: "🌙", color: "#be185d" },
];
