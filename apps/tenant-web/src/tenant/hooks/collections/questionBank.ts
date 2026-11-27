/**
 * Cross-module public surface for Question Bank Query hooks.
 * Other features and shared UI must import from here — not `@/tenant/features/question-bank/hooks/*`.
 */
export {
  QUESTION_BANK_METRICS_QUERY_KEY,
  QUESTION_BANK_QUESTIONS_QUERY_KEY,
  QUESTION_BANK_TESTS_QUERY_KEY,
  QUESTION_BANK_RESULTS_QUERY_KEY,
  QUESTION_BANK_REPORT_AGGREGATES_QUERY_KEY,
} from "@mms/mod-question-bank/frontend/tenant/hooks/questionBankQueryKeys";
export {
  useQuestionBankQuestions,
  useQuestionBankQuestionsCollection,
  useQuestionBankTests,
  useQuestionBankTestsCollection,
  useQuestionBankResults,
  useQuestionBankResultsCollection,
  useQuestionBankMutations,
  questionBankCommandMetricsQueryOptions,
  useQuestionBankMetrics,
  useQuestionBankReportAggregates,
} from "@mms/mod-question-bank/frontend/tenant/hooks/useQuestionBankApi";
export { useQuestionBankConfig } from "@mms/mod-question-bank/frontend/tenant/hooks/useQuestionBankConfig";
export { invalidateQuestionBankQueries } from "@mms/mod-question-bank/frontend/tenant/hooks/invalidateQuestionBankQueries";
// Phase 7: contract-driven tsrClient hooks & query factories
export {
  questionBankQuestionsListQueryOptions,
  useQuestionBankContractList,
  useQuestionBankContractTests,
  useQuestionBankContractResults,
  useQuestionBankContractBulkDelete,
  useQuestionBankContractBulkRestore,
  useQuestionBankContractDeleteQuestion,
  useQuestionBankContractRestoreQuestion,
} from "@mms/mod-question-bank/frontend/tenant/hooks/useQuestionBankQueries";
