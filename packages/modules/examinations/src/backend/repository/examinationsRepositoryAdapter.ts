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
  findExamResultVersionsByExam,
  saveExamResult,
  bulkSaveExamResults,
  replaceExamResultsForWorkspace,
} from "../repository/examinationRepository.js";
import {
  listExamsPage,
  aggregateExaminationsCommandMetrics,
} from "../repository/examinationRepositoryList.js";
import { loadExaminationsReportAggregatesSql } from "../repository/examinationRepositoryReport.js";
import { findExamResultsFingerprint } from "../repository/examinationResultsRepository.js";
import { listSessionClassNames } from "../repository/examinationExamsRepository.js";
import { aggregateExaminationsWidgetQueries } from "../repository/examinationsRepositoryWidgets.js";

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
  findExamResultsFingerprint,
  applyExamResultModeration,
  findExamResultById,
  findExamResultsByIds,
  findExamResultVersionsByExam,
  saveExamResult,
  bulkSaveExamResults,
  replaceExamResultsForWorkspace,
  aggregateExaminationsCommandMetrics,
  listSessionClassNames,
  aggregateExaminationsWidgetQueries,
  loadExaminationsReportAggregates: loadExaminationsReportAggregatesSql,
};
