import {
  countFillBlankMarkers,
  joinQuestionCompoundAnswer,
  splitQuestionCompoundAnswer,
  type QuestionBookCitation,
} from "@mms/contracts";
import type { QuestionFormDraft } from "./questionFormTypes";

function uniqueTrimmed(values: readonly string[]): string[] {
  return [...new Set(values.map((value: any) => value.trim()).filter(Boolean))];
}

function sanitizeCitations(citations: readonly QuestionBookCitation[]): QuestionBookCitation[] {
  return citations
    .map((citation: any) => {
      const bookId = citation.bookId.trim();
      const values = Object.fromEntries(
        Object.entries(citation.citation ?? {})
          .map(([key, value]) => [key, String(value ?? "").trim()] as const)
          .filter(([, value]) => value !== ""),
      );
      return { bookId, citation: values };
    })
    .filter((citation: any) => citation.bookId !== "");
}

function sanitizeMatching(draft: QuestionFormDraft): Pick<QuestionFormDraft, "options" | "answer"> {
  const rights = splitQuestionCompoundAnswer(draft.answer);
  const pairs = draft.options
    .map((left: any, index: any) => ({
      left: left.trim(),
      right: (rights[index] ?? "").trim(),
    }))
    .filter((pair: any) => pair.left !== "" || pair.right !== "");

  return {
    options: pairs.map((pair: any) => pair.left),
    answer: joinQuestionCompoundAnswer(pairs.map((pair: any) => pair.right)),
  };
}

/**
 * Normalizes the question draft to the flat wire shape before validation/save.
 *
 * Blank option/item/pair rows and empty citations are stripped here (the shared
 * Zod invariants then see only intentional rows), and compound answers are
 * rebuilt so ordering/matching/fill-blank stay aligned with their inputs.
 */
export function sanitizeQuestionDraft<T extends QuestionFormDraft>(draft: T): T {
  const base: QuestionFormDraft = {
    ...draft,
    text: draft.text.trim(),
    answer: draft.answer.trim(),
    categoryIds: uniqueTrimmed(draft.categoryIds),
    sourceCitations: sanitizeCitations(draft.sourceCitations),
  };

  switch (draft.type) {
    case "mcq":
    case "true_false":
      return {
        ...base,
        options: draft.options.map((option: any) => option.trim()).filter(Boolean),
      } as T;
    case "matching":
      return { ...base, ...sanitizeMatching(base) } as T;
    case "ordering": {
      const options = draft.options.map((item: any) => item.trim()).filter(Boolean);
      return { ...base, options, answer: joinQuestionCompoundAnswer(options) } as T;
    }
    case "fill_blank": {
      const blankCount = Math.max(countFillBlankMarkers(base.text), 1);
      const blanks = splitQuestionCompoundAnswer(base.answer).map((blank: any) => blank.trim());
      while (blanks.length < blankCount) blanks.push("");
      return {
        ...base,
        options: [],
        answer: joinQuestionCompoundAnswer(blanks.slice(0, blankCount)),
      } as unknown as T;
    }
    case "numeric": {
      const tolerance = draft.options[0]?.trim() ?? "";
      return { ...base, options: tolerance ? [tolerance] : [] } as T;
    }
    case "short":
      return { ...base, options: [] } as unknown as T;
    default:
      return base as T;
  }
}
