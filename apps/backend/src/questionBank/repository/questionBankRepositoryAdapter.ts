import type { QuestionBankRepository } from "./questionBankRepository.js";
import {
  listQuestionsByWorkspace,
  findQuestionById,
  findQuestionsByIds,
  saveQuestion,
  bulkSaveQuestions,
  replaceQuestionsForWorkspace,
  bulkSoftDeleteQuestions,
  bulkRestoreQuestions,
  listTestsByWorkspace,
  findTestById,
  findTestsByIds,
  saveTest,
  bulkSaveTests,
  replaceTestsForWorkspace,
  listResultsByWorkspace,
  findResultById,
  findResultsByIds,
  saveResult,
  bulkSaveResults,
  replaceResultsForWorkspace,
} from "../../db/repositories/questionBankRepository.js";
import {
  listQuestionsPage,
  aggregateQuestionBankCommandMetrics,
} from "../../db/repositories/questionBankRepositoryList.js";
import { aggregateQuestionBankWidgetQueries } from "../../db/repositories/questionBankRepositoryWidgets.js";
import { aggregateQuestionBankReport } from "../../db/repositories/questionBankRepositoryReport.js";

/**
 * Drizzle-backed adapter for {@link QuestionBankRepository}. Delegates to the
 * existing concrete repository functions (no SQL rewrite in this pass).
 */
export const questionBankRepository: QuestionBankRepository = {
  listQuestionsByWorkspace,
  findQuestionById,
  findQuestionsByIds,
  saveQuestion,
  bulkSaveQuestions,
  replaceQuestionsForWorkspace,
  bulkSoftDeleteQuestions,
  bulkRestoreQuestions,
  listQuestionsPage,
  listTestsByWorkspace,
  findTestById,
  findTestsByIds,
  saveTest,
  bulkSaveTests,
  replaceTestsForWorkspace,
  listResultsByWorkspace,
  findResultById,
  findResultsByIds,
  saveResult,
  bulkSaveResults,
  replaceResultsForWorkspace,
  aggregateQuestionBankCommandMetrics,
  aggregateQuestionBankWidgetQueries,
  aggregateQuestionBankReport,
};
