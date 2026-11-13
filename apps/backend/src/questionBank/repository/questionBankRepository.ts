import type {
  QuestionBankQuestion,
  QuestionBankTest,
  QuestionBankResult,
  QuestionBankListQuery,
  QuestionBankListPageResult,
  QuestionBankCommandMetricsSnapshot,
  QuestionBankReportAggregates,
  QuestionBankReportQuery,
  WidgetQuery,
  WidgetAggregateResult,
} from "@mms/shared";

/**
 * Sole storage gateway for the question bank module (questions, tests, results).
 *
 * Mirrors the `contacts`/`sessions`/`enrollments`/`finance`/`attendance`/`hasanat`
 * reference pattern: routes and use-cases depend on this interface (never on
 * Drizzle directly), and the Drizzle-backed adapter is the only implementation.
 * Tests can inject a fake repository at the seam.
 */
/** Ranked near-duplicate returned by the similarity lookup. */
export interface SimilarQuestionMatch {
  id: string;
  text: string;
  difficulty: string;
  categoryIds: string[];
  score: number;
}

export interface QuestionBankRepository {
  // Questions
  listQuestionsByWorkspace(
    tenant: string,
    options?: {
      limit?: number;
      offset?: number;
      deleted?: "active" | "deleted" | "all";
      includeDeleted?: boolean;
    },
  ): Promise<QuestionBankQuestion[]>;
  findQuestionById(tenant: string, id: string): Promise<QuestionBankQuestion | null>;
  findQuestionsByIds(
    tenant: string,
    ids: string[],
    options?: { deleted?: "active" | "deleted" | "all"; includeDeleted?: boolean },
  ): Promise<QuestionBankQuestion[]>;
  saveQuestion(tenant: string, record: QuestionBankQuestion): Promise<void>;
  bulkSaveQuestions(tenant: string, records: QuestionBankQuestion[]): Promise<void>;
  replaceQuestionsForWorkspace(tenant: string, records: QuestionBankQuestion[]): Promise<void>;
  bulkSoftDeleteQuestions?(
    tenant: string,
    ids: string[],
    deletedBy?: string,
    deletionReason?: string,
  ): Promise<{ succeeded: number; failed: number }>;
  bulkRestoreQuestions?(
    tenant: string,
    ids: string[],
    userId?: string,
  ): Promise<{ succeeded: number; failed: number }>;
  listQuestionsPage(
    tenant: string,
    query: QuestionBankListQuery,
  ): Promise<QuestionBankListPageResult>;
  listQuestionsPicker(
    tenant: string,
    query: QuestionBankListQuery,
  ): Promise<QuestionBankListPageResult>;

  // Lifecycle (0241)
  updateQuestionStatus?(
    tenant: string,
    change: {
      id: string;
      to: import("@mms/shared").QuestionStatus;
      actorId: string;
      reason?: string | null;
    },
  ): Promise<QuestionBankQuestion>;
  duplicateQuestionRow?(
    tenant: string,
    input: { sourceId: string; newId: string; actorId?: string | null },
  ): Promise<QuestionBankQuestion>;
  assemblePaper?(
    tenant: string,
    input: {
      testId: string;
      blueprint: import("@mms/shared").PaperBlueprint;
      actorId?: string | null;
    },
  ): Promise<{
    result: import("@mms/shared").BlueprintResult;
    questionIds: string[];
  }>;
  findSimilarQuestions?(
    tenant: string,
    input: { text: string; excludeId?: string; limit?: number },
  ): Promise<SimilarQuestionMatch[]>;
  addQuestionAttachment?(
    tenant: string,
    input: {
      id: string;
      questionId: string;
      kind: "stem" | "option";
      optionIndex: number | null;
      name: string;
      mime: string;
      size: number;
      url: string;
      actorId?: string | null;
    },
  ): Promise<import("@mms/shared").QuestionAttachment>;
  removeQuestionAttachment?(
    tenant: string,
    input: { questionId: string; attachmentId: string; actorId?: string | null },
  ): Promise<string>;
  isQuestionAttachmentReferenced?(tenant: string, urls: string[]): Promise<boolean>;
  setPaperPublished?(
    tenant: string,
    change: { testId: string; published: boolean; actorId: string },
  ): Promise<void>;

  // Tests
  listTestsByWorkspace(
    tenant: string,
    options?: { limit?: number; offset?: number },
  ): Promise<QuestionBankTest[]>;
  findTestById(tenant: string, id: string): Promise<QuestionBankTest | null>;
  findTestsByIds(
    tenant: string,
    ids: string[],
    options?: { deleted?: "active" | "deleted" | "all"; includeDeleted?: boolean },
  ): Promise<QuestionBankTest[]>;
  saveTest(tenant: string, record: QuestionBankTest): Promise<void>;
  bulkSaveTests(tenant: string, records: QuestionBankTest[]): Promise<void>;
  replaceTestsForWorkspace(tenant: string, records: QuestionBankTest[]): Promise<void>;

  // Results
  listResultsByWorkspace(
    tenant: string,
    options?: { limit?: number; offset?: number },
  ): Promise<QuestionBankResult[]>;
  findResultById(tenant: string, id: string): Promise<QuestionBankResult | null>;
  findResultsByIds(
    tenant: string,
    ids: string[],
    options?: { deleted?: "active" | "deleted" | "all"; includeDeleted?: boolean },
  ): Promise<QuestionBankResult[]>;
  saveResult(tenant: string, record: QuestionBankResult): Promise<void>;
  bulkSaveResults(tenant: string, records: QuestionBankResult[]): Promise<void>;
  replaceResultsForWorkspace(tenant: string, records: QuestionBankResult[]): Promise<void>;

  // Aggregates
  aggregateQuestionBankCommandMetrics(tenant: string): Promise<QuestionBankCommandMetricsSnapshot>;
  aggregateQuestionBankWidgetQueries(
    tenant: string,
    queries: WidgetQuery[],
  ): Promise<Record<string, WidgetAggregateResult>>;
  aggregateQuestionBankReport(
    tenant: string,
    query?: QuestionBankReportQuery,
  ): Promise<QuestionBankReportAggregates>;
}
