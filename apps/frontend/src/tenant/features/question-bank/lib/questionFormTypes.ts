import type {
  AppLanguageCode,
  QuestionBankQuestion as Question,
  QuestionBookCitation,
  QuestionDifficulty,
  QuestionType,
} from "@mms/shared";

export interface QuestionFormProps {
  open: boolean;
  question: Question | null;
  questions?: Question[];
  onClose: () => void;
  onSave: (q: Question) => void | Promise<void>;
}

export interface QuestionFormDraft {
  /** Present when the draft came from a stored question (used to exclude it from its own duplicate check). */
  id?: string;
  categoryIds: string[];
  type: QuestionType;
  difficulty: QuestionDifficulty;
  questionLanguage: AppLanguageCode;
  text: string;
  options: string[];
  answer: string;
  sourceCitations: QuestionBookCitation[];
  /** OCC token carried back to the API so a stale edit is rejected with 409 (migration 0240). */
  version?: number;
}

export type QuestionFormErrors = Record<string, string>;
export type UpdateQuestionDraft = (patch: Partial<QuestionFormDraft>) => void;
