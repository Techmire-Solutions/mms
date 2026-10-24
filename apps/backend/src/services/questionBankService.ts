import { questionBankUseCases } from "../questionBank/use-cases/questionBankUseCases.js";

/**
 * Thin re-export of the question bank use-cases facade.
 *
 * Kept for backward compatibility with existing importers (contract router,
 * tests). New code should depend on
 * `questionBank/use-cases/questionBankUseCases.js` directly.
 */
export const replaceQuestions = questionBankUseCases.replaceQuestions;
export const replaceTests = questionBankUseCases.replaceTests;
export const replaceResults = questionBankUseCases.replaceResults;
export const loadQuestions = questionBankUseCases.loadQuestions;
export const loadQuestionsPage = questionBankUseCases.loadQuestionsPage;
export const loadTests = questionBankUseCases.loadTests;
export const loadResults = questionBankUseCases.loadResults;
export const upsertQuestions = questionBankUseCases.upsertQuestions;
export const upsertTests = questionBankUseCases.upsertTests;
export const upsertResults = questionBankUseCases.upsertResults;
export const createQuestion = questionBankUseCases.createQuestion;
export const updateQuestionById = questionBankUseCases.updateQuestionById;
export const loadQuestionById = questionBankUseCases.loadQuestionById;
export const loadQuestionsByIds = questionBankUseCases.loadQuestionsByIds;
export const saveQuestion = questionBankUseCases.saveQuestion;
export const loadTestById = questionBankUseCases.loadTestById;
export const loadTestsByIds = questionBankUseCases.loadTestsByIds;
export const saveTest = questionBankUseCases.saveTest;
export const loadResultById = questionBankUseCases.loadResultById;
export const loadResultsByIds = questionBankUseCases.loadResultsByIds;
export const saveResult = questionBankUseCases.saveResult;
export const deleteQuestionById = questionBankUseCases.deleteQuestionById;
export const restoreQuestionById = questionBankUseCases.restoreQuestionById;
export const bulkSoftDeleteQuestions = questionBankUseCases.bulkSoftDeleteQuestions;
export const bulkRestoreQuestions = questionBankUseCases.bulkRestoreQuestions;
export const loadQuestionBankWidgetAggregates =
  questionBankUseCases.loadQuestionBankWidgetAggregates;
export const loadQuestionBankReportAggregates =
  questionBankUseCases.loadQuestionBankReportAggregates;
export const loadQuestionBankCommandMetrics = questionBankUseCases.loadQuestionBankCommandMetrics;
