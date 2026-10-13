import { slugifyCategoryName } from "./questionBankCategoryUtils.js";
import {
  QUESTION_SOURCE_BOOK_FIELD_IDS,
  QUESTION_SOURCE_CITATION_FIELD_IDS,
  type QuestionSourceBook,
  type QuestionSourceFieldId,
} from "./questionBankEntities.js";

const QUESTION_SOURCE_BOOK_FIELD_IDS_SET = new Set<string>(QUESTION_SOURCE_BOOK_FIELD_IDS);
const QUESTION_SOURCE_CITATION_FIELD_IDS_SET = new Set<string>(QUESTION_SOURCE_CITATION_FIELD_IDS);

/** Returns whether a field belongs to a source-book definition. */
export function isQuestionSourceBookFieldId(fieldId: string): boolean {
  return QUESTION_SOURCE_BOOK_FIELD_IDS_SET.has(fieldId);
}

/** Returns whether a field belongs to a per-question citation. */
export function isQuestionSourceCitationFieldId(fieldId: string): boolean {
  return QUESTION_SOURCE_CITATION_FIELD_IDS_SET.has(fieldId);
}

/** Creates a unique source-book registry entry. */
export function createQuestionSourceBook(
  name: string,
  existing: readonly QuestionSourceBook[] = [],
): QuestionSourceBook {
  const trimmed = name.trim();
  const slug = slugifyCategoryName(trimmed || "book");
  const existingIds = new Set(existing.map((book) => book.id));
  let id = `book-${slug}`;
  let suffix = 1;
  while (existingIds.has(id)) {
    id = `book-${slug}-${suffix}`;
    suffix += 1;
  }
  return {
    id,
    name: trimmed || id,
    fieldIds: ["sourceBookName"],
    metadata: { bookName: trimmed },
  };
}

/** Returns book-level fields used when editing a registry book. */
export function getBookDefinitionFieldIds(
  book: Pick<QuestionSourceBook, "fieldIds">,
): QuestionSourceFieldId[] {
  return book.fieldIds.filter((fieldId) => isQuestionSourceBookFieldId(fieldId));
}

/** Returns per-question citation fields used for a selected book. */
export function getBookCitationFieldIds(
  book: Pick<QuestionSourceBook, "fieldIds">,
): QuestionSourceFieldId[] {
  return book.fieldIds.filter((fieldId) => isQuestionSourceCitationFieldId(fieldId));
}
