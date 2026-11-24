import type { QuestionDifficulty, QuestionLanguageCode, QuestionType } from "./questionBankCore.js";
import type { QuestionStatus } from "./questionLifecycle.js";
import type { QuestionBookCitation, QuestionSourceReference } from "./questionBankSourceFields.js";

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

/** Media attached to a question stem or one of its options (migration 0242). */
export interface QuestionAttachment {
  id: string;
  kind: "stem" | "option";
  /** Index into `options` for `kind: "option"`, otherwise null. */
  optionIndex: number | null;
  name: string;
  mime: string;
  size: number;
  url: string;
  sortOrder: number;
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
  /** Images/audio/diagrams on the stem or its options (server-managed; migration 0242). */
  attachments?: QuestionAttachment[];
  /** Number of papers referencing this question (computed on request). */
  usageCount?: number;
  /** @deprecated Resolved flat sources — derived from citations for legacy reads. */
  sources?: QuestionSourceReference[];
  /** @deprecated First source — kept for legacy reads; use `sourceCitations`. */
  source?: QuestionSourceReference;
  /**
   * OCC token (migration 0240). Echo the value read from the server: a save carrying a stale
   * version writes nothing and returns `409 stale_write`. Omitted → legacy last-write-wins.
   */
  version?: number;
  createdAt?: string;
  updatedAt?: string;
  /** Authoring lifecycle (migration 0241). Server-owned; the bulk write never changes it. */
  status?: QuestionStatus;
  deletedAt?: string | null;
  deletedBy?: string | null;
  deletionReason?: string | null;
  restoredAt?: string | null;
  restoredBy?: string | null;
  deletedWithCascade?: boolean | null;
}

export interface QuestionBankTest {
  id: string;
  name: string;
  categoryId: string | null;
  questionIds: string[];
  difficulty: QuestionDifficulty | "mixed";
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
  /** Publication stamp (migration 0241): a published paper's question set is frozen. */
  publishedAt?: string | null;
  publishedBy?: string | null;
  /** Seed of the last deterministic blueprint assembly (migration 0242). */
  assemblySeed?: string | null;
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
