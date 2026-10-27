import { createModuleQueryInvalidator } from "@/lib/query/createModuleQueryInvalidator";
import {
  QUESTION_BANK_METRICS_QUERY_KEY,
  QUESTION_BANK_QUESTIONS_QUERY_KEY,
  QUESTION_BANK_RESULTS_QUERY_KEY,
  QUESTION_BANK_TESTS_QUERY_KEY,
} from "@/tenant/features/question-bank/hooks/useQuestionBankApi";

/** Invalidate Question Bank questions/tests/results/metrics Query keys. */
export const invalidateQuestionBankQueries = createModuleQueryInvalidator({
  list: QUESTION_BANK_QUESTIONS_QUERY_KEY,
  lists: [QUESTION_BANK_TESTS_QUERY_KEY, QUESTION_BANK_RESULTS_QUERY_KEY],
  metrics: QUESTION_BANK_METRICS_QUERY_KEY,
});
