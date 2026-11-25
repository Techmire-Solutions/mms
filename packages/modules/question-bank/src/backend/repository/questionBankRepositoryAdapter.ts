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
} from "../repository/questionBankDbBarrel.js";
import { listQuestionsPage } from "../repository/questionBankRepositoryList.js";
import { listQuestionsPicker } from "../repository/questionBankRepositoryPicker.js";
import { aggregateQuestionBankCommandMetrics } from "../repository/questionBankRepositoryMetrics.js";
import { aggregateQuestionBankWidgetQueries } from "../repository/questionBankRepositoryWidgets.js";
import { aggregateQuestionBankReport } from "../repository/questionBankRepositoryReport.js";
import {
  duplicateQuestionRow,
  setPaperPublished,
  updateQuestionStatus,
} from "../repository/questionBankLifecyclePersist.js";
import { assemblePaperForTest } from "../repository/questionBankAssemblyPersist.js";
import { findSimilarQuestions } from "../repository/questionSimilarityRepository.js";
import {
  addQuestionAttachment,
  isQuestionAttachmentReferenced,
  removeQuestionAttachment,
} from "../repository/questionBankAttachmentsRepository.js";

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
  listQuestionsPicker,
  updateQuestionStatus,
  duplicateQuestionRow,
  setPaperPublished,
  assemblePaper: assemblePaperForTest,
  findSimilarQuestions,
  addQuestionAttachment,
  removeQuestionAttachment,
  isQuestionAttachmentReferenced,
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
