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
  categoryIds: string[];
  type: QuestionType;
  difficulty: QuestionDifficulty;
  questionLanguage: AppLanguageCode;
  text: string;
  options: string[];
  answer: string;
  sourceCitations: QuestionBookCitation[];
}

export type QuestionFormErrors = Record<string, string>;
export type UpdateQuestionDraft = (patch: Partial<QuestionFormDraft>) => void;
