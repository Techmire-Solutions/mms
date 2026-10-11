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

  // Tests
  listTestsByWorkspace(tenant: string): Promise<QuestionBankTest[]>;
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
  listResultsByWorkspace(tenant: string): Promise<QuestionBankResult[]>;
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
