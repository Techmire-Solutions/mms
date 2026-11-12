import { createModuleQueryInvalidator } from "@/lib/query/createModuleQueryInvalidator";
import {
  QUESTION_BANK_METRICS_QUERY_KEY,
  QUESTION_BANK_QUESTIONS_QUERY_KEY,
  QUESTION_BANK_REPORT_AGGREGATES_QUERY_KEY,
  QUESTION_BANK_RESULTS_QUERY_KEY,
  QUESTION_BANK_TESTS_QUERY_KEY,
} from "./questionBankQueryKeys.js";

/** Invalidate Question Bank questions/tests/results/metrics Query keys. */
export const invalidateQuestionBankQueries = createModuleQueryInvalidator({
  list: QUESTION_BANK_QUESTIONS_QUERY_KEY,
  lists: [QUESTION_BANK_TESTS_QUERY_KEY, QUESTION_BANK_RESULTS_QUERY_KEY],
  metrics: QUESTION_BANK_METRICS_QUERY_KEY,
  // The report aggregates carry a 5-minute staleTime; without this the coverage/difficulty panels
  // stayed stale after create/approve/retire.
  reports: QUESTION_BANK_REPORT_AGGREGATES_QUERY_KEY,
});
