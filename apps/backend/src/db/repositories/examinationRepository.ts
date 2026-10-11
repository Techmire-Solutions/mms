export {
  examRowToRecord,
  listExamsByWorkspace,
  findExamById,
  findExamsByIds,
  saveExam,
  bulkSaveExams,
  replaceExamsForWorkspace,
  bulkSoftDeleteExams,
  bulkRestoreExams,
} from "./examinationExamsRepository.js";
export {
  listExamResultsByWorkspace,
  findExamResultById,
  findExamResultsByIds,
  saveExamResult,
  bulkSaveExamResults,
  replaceExamResultsForWorkspace,
  deleteExaminationsByWorkspace,
} from "./examinationResultsRepository.js";
