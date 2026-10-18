import type {
  QuestionDifficulty,
  QuestionLanguageCode,
  QuestionType,
} from './questionBankCore.js';
import type {
  QuestionBookCitation,
  QuestionSourceReference,
} from './questionBankSourceFields.js';

export interface QuestionTypeRegistryEntry {
  id: QuestionType;
  enabled: boolean;
}

export interface QuestionDifficultyRegistryEntry {
  id: QuestionDifficulty;
  enabled: boolean;
}

export interface QuestionCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
}

/** Stored question-bank question with categories and optional source citations. */
export interface QuestionBankQuestion {
  id: string;
  /** All categories for this question (one or more). */
  categoryIds: string[];
  /** @deprecated First category — kept for legacy reads; use `categoryIds`. */
  categoryId?: string;
  type: QuestionType;
  difficulty: QuestionDifficulty;
  /** Language the question text is written in. */
  questionLanguage: QuestionLanguageCode;
  text: string;
  options: string[];
  answer: string;
  /** @deprecated Marks removed from UI — defaults to 1 for grading; kept for legacy stored questions. */
  marks?: number;
  /** @deprecated Tags removed from UI — kept for legacy stored questions. */
  tags?: string[];
  /** Registered-book citations for this question. */
  sourceCitations?: QuestionBookCitation[];
  /** @deprecated Resolved flat sources — derived from citations for legacy reads. */
  sources?: QuestionSourceReference[];
  /** @deprecated First source — kept for legacy reads; use `sourceCitations`. */
  source?: QuestionSourceReference;
  deletedAt?: string | null;
  deletedBy?: string | null;
  deletionReason?: string | null;
}

export interface QuestionBankTest {
  id: string;
  name: string;
  categoryId: string | null;
  questionIds: string[];
  difficulty: QuestionDifficulty | 'mixed';
  duration: number;
  createdAt: string;
  /** Manual paper-builder class/section label printed on the exam paper. */
  examClass?: string;
  /** `session_classes.id` the paper is set for; `examClass` stays as the printed label. */
  classId?: string | null;
  /** Manual paper-builder total marks printed on the exam paper. */
  totalMarks?: number;
  /** Manual paper-builder instructions printed before paper sections. */
  instructions?: string;
  /** Manual paper-builder sections and their selected question order. */
  sections?: QuestionBankPaperSection[];
  deletedAt?: string | null;
  deletedBy?: string | null;
  deletionReason?: string | null;
}

export interface QuestionBankPaperSection {
  id: string;
  title: string;
  instructions: string;
  questionIds: string[];
}

export interface QuestionBankResult {
  id: string;
  testId: string;
  studentId: string;
  studentName: string;
  submittedAt: string;
  answers: Record<string, string>;
  scores: Record<string, number>;
  deletedAt?: string | null;
  deletedBy?: string | null;
  deletionReason?: string | null;
}
