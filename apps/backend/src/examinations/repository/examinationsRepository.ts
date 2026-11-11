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
  /** Session classes, by name, for the CSV importer's class resolution. */
  listSessionClassNames(tenant: string): Promise<Array<{ id: string; name: string }>>;
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
  /** Filterable, keyset-paginated marks (the broadsheet read path). */
  listExamResultsPage(
    tenant: string,
    query: {
      examId?: string;
      studentId?: string;
      cursor?: string;
      limit?: number;
      publishedOnly?: boolean;
    },
  ): Promise<{ results: ExamResult[]; hasMore: boolean }>;
  /** Audited grace-mark adjustment; the raw mark is preserved. */
  applyExamResultModeration(
    tenant: string,
    input: {
      examId: string;
      studentId: string;
      graceMarks: number;
      reason: string;
      actorId: string;
      version?: number;
    },
  ): Promise<{
    examId: string;
    studentId: string;
    marksObtained: number;
    graceMarks: number;
    effectiveMarks: number;
    moderationReason: string | null;
    moderatedAt: string | null;
    version: number;
  }>;
  findExamResultById(tenant: string, id: string): Promise<ExamResult | null>;
  findExamResultsByIds(tenant: string, ids: string[]): Promise<ExamResult[]>;
  /**
   * Existing `(student, id, version)` marks for one exam.
   *
   * Non-interactive writers (the queued CSV import) must echo the stored OCC token, otherwise they
   * take the last-write-wins upsert branch and silently replace a concurrent examiner's correction.
   */
  findExamResultVersionsByExam(
    tenant: string,
    examId: string,
  ): Promise<Array<{ studentId: string; id: string; version: number }>>;
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
    options?: { publishedOnly?: boolean },
  ): Promise<ExaminationsReportAggregates>;
}
