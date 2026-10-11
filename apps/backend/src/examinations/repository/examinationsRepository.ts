import type {
  Exam,
  ExamResult,
  ExaminationsListQuery,
  ExaminationsListPageResult,
  ExaminationsCommandMetricsSnapshot,
  ExaminationsReportAggregates,
  ExaminationsReportComparisonQuery,
  WidgetQuery,
  WidgetAggregateResult,
} from "@mms/shared";

/**
 * Sole storage gateway for the examinations module (exams + results).
 *
 * Mirrors the `contacts`/`sessions`/`enrollments`/`finance`/`attendance`/`hasanat`/
 * `questionBank` reference pattern: routes and use-cases depend on this interface
 * (never on Drizzle directly), and the Drizzle-backed adapter is the only
 * implementation. Tests can inject a fake repository at the seam.
 */
export interface ExaminationsRepository {
  // Exams
  listExamsByWorkspace(
    tenant: string,
    options?: {
      limit?: number;
      offset?: number;
      deleted?: "active" | "deleted" | "all";
      includeDeleted?: boolean;
    },
  ): Promise<Exam[]>;
  findExamById(tenant: string, id: string): Promise<Exam | null>;
  findExamsByIds(
    tenant: string,
    ids: string[],
    options?: { deleted?: "active" | "deleted" | "all"; includeDeleted?: boolean },
  ): Promise<Exam[]>;
  saveExam(tenant: string, record: Exam): Promise<void>;
  bulkSaveExams(tenant: string, records: Exam[]): Promise<void>;
  replaceExamsForWorkspace(tenant: string, records: Exam[]): Promise<void>;
  bulkSoftDeleteExams?(
    tenant: string,
    ids: string[],
    deletedBy?: string,
    deletionReason?: string,
  ): Promise<{ succeeded: number; failed: number }>;
  bulkRestoreExams?(
    tenant: string,
    ids: string[],
    userId?: string,
  ): Promise<{ succeeded: number; failed: number }>;
  listExamsPage(tenant: string, query: ExaminationsListQuery): Promise<ExaminationsListPageResult>;

  // Results
  listExamResultsByWorkspace(tenant: string): Promise<ExamResult[]>;
  findExamResultById(tenant: string, id: string): Promise<ExamResult | null>;
  findExamResultsByIds(tenant: string, ids: string[]): Promise<ExamResult[]>;
  saveExamResult(tenant: string, record: ExamResult): Promise<void>;
  bulkSaveExamResults(tenant: string, records: ExamResult[]): Promise<void>;
  replaceExamResultsForWorkspace(tenant: string, records: ExamResult[]): Promise<void>;

  // Aggregates
  aggregateExaminationsCommandMetrics(tenant: string): Promise<ExaminationsCommandMetricsSnapshot>;
  aggregateExaminationsWidgetQueries(
    tenant: string,
    queries: WidgetQuery[],
  ): Promise<Record<string, WidgetAggregateResult>>;
  loadExaminationsReportAggregates(
    tenant: string,
    comparisonQuery?: ExaminationsReportComparisonQuery,
  ): Promise<ExaminationsReportAggregates>;
}
