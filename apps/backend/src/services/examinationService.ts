import { examinationsUseCases } from "../examinations/use-cases/examinationsUseCases.js";

/**
 * Thin re-export of the examinations use-cases facade.
 *
 * Kept for backward compatibility with existing importers (report routes,
 * tests). New code should depend on
 * `examinations/use-cases/examinationsUseCases.js` directly.
 */
export const replaceExams = examinationsUseCases.replaceExams;
export const replaceExamResults = examinationsUseCases.replaceExamResults;
export const loadExams = examinationsUseCases.loadExams;
export const loadExamById = examinationsUseCases.loadExamById;
export const loadExamsByIds = examinationsUseCases.loadExamsByIds;
export const loadExamsPage = examinationsUseCases.loadExamsPage;
export const loadExamResults = examinationsUseCases.loadExamResults;
export const loadExamResultById = examinationsUseCases.loadExamResultById;
export const loadExamResultsByIds = examinationsUseCases.loadExamResultsByIds;
export const upsertExams = examinationsUseCases.upsertExams;
export const upsertExamResults = examinationsUseCases.upsertExamResults;
export const createExam = examinationsUseCases.createExam;
export const updateExamById = examinationsUseCases.updateExamById;
export const deleteExamById = examinationsUseCases.deleteExamById;
export const restoreExamById = examinationsUseCases.restoreExamById;
export const bulkSoftDeleteExams = examinationsUseCases.bulkSoftDeleteExams;
export const bulkRestoreExams = examinationsUseCases.bulkRestoreExams;
export const loadExaminationsCommandMetrics = examinationsUseCases.loadExaminationsCommandMetrics;
export const loadExaminationsWidgetAggregates =
  examinationsUseCases.loadExaminationsWidgetAggregates;
export const loadExaminationsReportAggregates =
  examinationsUseCases.loadExaminationsReportAggregates;
