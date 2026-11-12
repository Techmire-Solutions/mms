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
import { listQuestionsPage } from "../../db/repositories/questionBankRepositoryList.js";
import { listQuestionsPicker } from "../../db/repositories/questionBankRepositoryPicker.js";
import { aggregateQuestionBankCommandMetrics } from "../../db/repositories/questionBankRepositoryMetrics.js";
import { aggregateQuestionBankWidgetQueries } from "../../db/repositories/questionBankRepositoryWidgets.js";
import { aggregateQuestionBankReport } from "../../db/repositories/questionBankRepositoryReport.js";
import {
  duplicateQuestionRow,
  setPaperPublished,
  updateQuestionStatus,
} from "../../db/repositories/questionBankLifecyclePersist.js";
import { assemblePaperForTest } from "../../db/repositories/questionBankAssemblyPersist.js";
import { findSimilarQuestions } from "../../db/repositories/questionSimilarityRepository.js";
import {
  addQuestionAttachment,
  isQuestionAttachmentReferenced,
  removeQuestionAttachment,
} from "../../db/repositories/questionBankAttachmentsRepository.js";

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
