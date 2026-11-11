import type { ExaminationsRepository } from "./examinationsRepository.js";
import {
  listExamsByWorkspace,
  findExamById,
  findExamsByIds,
  saveExam,
  bulkSaveExams,
  replaceExamsForWorkspace,
  bulkSoftDeleteExams,
  bulkRestoreExams,
  listExamResultsByWorkspace,
  listExamResultsPage,
  applyExamResultModeration,
  findExamResultById,
  findExamResultsByIds,
  saveExamResult,
  bulkSaveExamResults,
  replaceExamResultsForWorkspace,
} from "../../db/repositories/examinationRepository.js";
import {
  listExamsPage,
  aggregateExaminationsCommandMetrics,
} from "../../db/repositories/examinationRepositoryList.js";
import { loadExaminationsReportAggregatesSql } from "../../db/repositories/examinationRepositoryReport.js";
import { listSessionClassNames } from "../../db/repositories/examinationExamsRepository.js";
import { aggregateExaminationsWidgetQueries } from "../../db/repositories/examinationsRepositoryWidgets.js";

/**
 * Drizzle-backed adapter for {@link ExaminationsRepository}. Delegates to the
 * existing concrete repository functions (no SQL rewrite in this pass).
 */
export const examinationsRepository: ExaminationsRepository = {
  listExamsByWorkspace,
  findExamById,
  findExamsByIds,
  saveExam,
  bulkSaveExams,
  replaceExamsForWorkspace,
  bulkSoftDeleteExams,
  bulkRestoreExams,
  listExamsPage,
  listExamResultsByWorkspace,
  listExamResultsPage,
  applyExamResultModeration,
  findExamResultById,
  findExamResultsByIds,
  saveExamResult,
  bulkSaveExamResults,
  replaceExamResultsForWorkspace,
  aggregateExaminationsCommandMetrics,
  listSessionClassNames,
  aggregateExaminationsWidgetQueries,
  loadExaminationsReportAggregates: loadExaminationsReportAggregatesSql,
};
