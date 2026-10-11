import type { QueryClient } from "@tanstack/react-query";
import {
  QUESTION_BANK_METRICS_QUERY_KEY,
  QUESTION_BANK_QUESTIONS_QUERY_KEY,
  QUESTION_BANK_RESULTS_QUERY_KEY,
  QUESTION_BANK_TESTS_QUERY_KEY,
} from "@/tenant/features/question-bank/hooks/useQuestionBankApi";

/** Invalidate Question Bank questions/tests/results/metrics Query keys (mutations + live push). */
export function invalidateQuestionBankQueries(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: QUESTION_BANK_QUESTIONS_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: QUESTION_BANK_TESTS_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: QUESTION_BANK_RESULTS_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: QUESTION_BANK_METRICS_QUERY_KEY });
}
