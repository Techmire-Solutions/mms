import type { ExaminationsRepository } from "../repository/examinationsRepository.js";
import { examinationsRepository } from "../repository/examinationsRepositoryAdapter.js";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { createGenericRelationalService } from "../../services/genericRelationalService.js";
import {
  defineTenantBulkCollectionService,
  upsertWithBroadcast,
} from "../../services/tenantBulkService.js";
import {
  dedupeTrimmedIds,
  type Exam,
  type ExamResult,
  type ExaminationsCommandMetricsSnapshot,
  type ExaminationsListQuery,
  examListSchema,
  examResultListSchema,
  examRecordSchema,
  type WidgetQuery,
  type WidgetAggregateResult,
  type ExaminationsReportComparisonQuery,
  type ExaminationsReportAggregates,
  EMPTY_EXAMINATIONS_REPORT_AGGREGATES,
} from "@mms/shared";

const EMPTY_EXAMINATIONS_METRICS: ExaminationsCommandMetricsSnapshot = {
  total: 0,
  upcoming: 0,
  ongoing: 0,
  completed: 0,
  scheduled: 0,
  cancelled: 0,
  totalResults: 0,
  examsWithResults: 0,
  passRate: 0,
};

/**
 * Examinations use-cases — composition root binding an
 * {@link ExaminationsRepository} to every operation. Production uses the default
 * Drizzle-backed `examinationsUseCases`; tests can pass a fake repository to
 * exercise orchestration in isolation.
 */
export function createExaminationsUseCases(repo: ExaminationsRepository = examinationsRepository) {
  const examBulkService = defineTenantBulkCollectionService<Exam>(
    {
      listByWorkspace: repo.listExamsByWorkspace,
      replaceForWorkspace: repo.replaceExamsForWorkspace,
    },
    examListSchema,
    "exams",
  );

  const examResultBulkService = defineTenantBulkCollectionService<ExamResult>(
    {
      listByWorkspace: repo.listExamResultsByWorkspace,
      replaceForWorkspace: repo.replaceExamResultsForWorkspace,
    },
    examResultListSchema,
    "exam_results",
  );

  const examCrud = createGenericRelationalService<Exam>({
    repo: {
      listByWorkspace: repo.listExamsByWorkspace,
      findById: repo.findExamById,
      save: repo.saveExam,
      bulkDelete: repo.bulkSoftDeleteExams,
      bulkRestore: repo.bulkRestoreExams,
    },
    schema: examRecordSchema,
    websocketCollection: "exams",
    idPrefix: "ex",
  });

  return {
    replaceExams: examBulkService.replace,
    replaceExamResults: examResultBulkService.replace,

    loadExams: examCrud.loadAll,

    loadExamById: async (id: string, includeDeleted = false): Promise<Exam | null> => {
      const tenant = getRequestTenant();
      const cleanId = id?.trim();
      if (!tenant || !cleanId) return null;
      const row = await repo.findExamById(tenant, cleanId);
      if (!row) return null;
      if (!includeDeleted && row.deletedAt) return null;
      return row;
    },

    loadExamsByIds: async (ids: string[], includeDeleted = false): Promise<Exam[]> => {
      const tenant = getRequestTenant();
      const cleanIds = dedupeTrimmedIds(ids);
      if (!tenant || cleanIds.length === 0) return [];
      return repo.findExamsByIds(tenant, cleanIds, { includeDeleted });
    },

    loadExamsPage: async (query: ExaminationsListQuery & { includeDeleted?: boolean }) => {
      const tenant = getRequestTenant();
      if (!tenant) {
        return {
          exams: [],
          total: 0,
          page: query.page ?? 1,
          limit: query.limit ?? 12,
          hasMore: false,
        };
      }
      return repo.listExamsPage(tenant, query);
    },

    loadExamResults: async (): Promise<ExamResult[]> => examResultBulkService.load(),

    loadExamResultById: async (id: string): Promise<ExamResult | null> => {
      const tenant = getRequestTenant();
      const cleanId = id?.trim();
      if (!tenant || !cleanId) return null;
      return repo.findExamResultById(tenant, cleanId);
    },

    loadExamResultsByIds: async (ids: string[]): Promise<ExamResult[]> => {
      const tenant = getRequestTenant();
      const cleanIds = dedupeTrimmedIds(ids);
      if (!tenant || cleanIds.length === 0) return [];
      return repo.findExamResultsByIds(tenant, cleanIds);
    },

    upsertExams: (records: Exam[]) =>
      upsertWithBroadcast(examListSchema, records, repo.bulkSaveExams, "exams"),
    upsertExamResults: (records: ExamResult[]) =>
      upsertWithBroadcast(examResultListSchema, records, repo.bulkSaveExamResults, "exam_results"),

    createExam: examCrud.create,
    updateExamById: examCrud.updateById,

    deleteExamById: examCrud.deleteById,
    restoreExamById: examCrud.restoreById,
    bulkSoftDeleteExams: examCrud.bulkDeleteByIds,
    bulkRestoreExams: examCrud.bulkRestoreByIds,

    loadExaminationsCommandMetrics: async (): Promise<ExaminationsCommandMetricsSnapshot> => {
      const tenant = getRequestTenant();
      if (!tenant) return EMPTY_EXAMINATIONS_METRICS;
      return repo.aggregateExaminationsCommandMetrics(tenant);
    },

    loadExaminationsWidgetAggregates: async (
      queries: WidgetQuery[],
    ): Promise<Record<string, WidgetAggregateResult>> => {
      const tenant = getRequestTenant();
      if (!tenant) return {};
      return repo.aggregateExaminationsWidgetQueries(tenant, queries);
    },

    loadExaminationsReportAggregates: async (
      comparisonQuery: ExaminationsReportComparisonQuery | undefined,
    ): Promise<ExaminationsReportAggregates> => {
      const tenant = getRequestTenant();
      if (!tenant) return EMPTY_EXAMINATIONS_REPORT_AGGREGATES;
      return repo.loadExaminationsReportAggregates(tenant, comparisonQuery);
    },
  };
}

export const examinationsUseCases = createExaminationsUseCases();
