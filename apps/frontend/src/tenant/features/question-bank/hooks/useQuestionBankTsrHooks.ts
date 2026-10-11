/**
 * Phase 7: Contract-driven query/mutation hooks for the Question Bank module.
 */
import { apiContract, tsrClient } from "@/lib/api";
import { queryOptions, useQueryClient } from "@tanstack/react-query";
import {
  QUESTION_BANK_QUESTIONS_QUERY_KEY,
  QUESTION_BANK_TESTS_QUERY_KEY,
  QUESTION_BANK_RESULTS_QUERY_KEY,
} from "@/tenant/features/question-bank/hooks/useQuestionBankApi";
import { invalidateQuestionBankQueries } from "@/tenant/features/question-bank/hooks/invalidateQuestionBankQueries";

export function questionBankQuestionsListQueryOptions(
  query: {
    page?: number;
    limit?: number;
    search?: string;
    includeDeleted?: boolean;
    [key: string]: unknown;
  } = {},
) {
  return queryOptions({
    queryKey: [...QUESTION_BANK_QUESTIONS_QUERY_KEY, "contract", query] as const,
    queryFn: async ({ signal }) => {
      const response = await apiContract.questionBank.listQuestions({
        query: query as Record<string, string>,
        signal,
        fetchOptions: { signal },
      });
      if (response.status !== 200) {
        throw new Error("Failed to fetch question bank questions");
      }
      return response.body;
    },
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });
}

export function useQuestionBankContractList(query: Record<string, unknown> = {}, enabled = true) {
  // @ts-expect-error - TS union discrimination limit with ts-rest
  return tsrClient.questionBank.listQuestions.useQuery({
    queryKey: [...QUESTION_BANK_QUESTIONS_QUERY_KEY, "contract-list", query],
    queryData: { query },
    staleTime: 15_000,
    enabled,
  });
}

export function useQuestionBankContractTests(enabled = true) {
  // @ts-expect-error - TS union discrimination limit with ts-rest
  return tsrClient.questionBank.listTests.useQuery({
    queryKey: [...QUESTION_BANK_TESTS_QUERY_KEY, "contract-list"],
    queryData: { query: {} },
    staleTime: 30_000,
    enabled,
  });
}

export function useQuestionBankContractResults(enabled = true) {
  // @ts-expect-error - TS union discrimination limit with ts-rest
  return tsrClient.questionBank.listResults.useQuery({
    queryKey: [...QUESTION_BANK_RESULTS_QUERY_KEY, "contract-list"],
    queryData: { query: {} },
    staleTime: 30_000,
    enabled,
  });
}

export function useQuestionBankContractBulkDelete() {
  const queryClient = useQueryClient();
  // @ts-expect-error - TS union discrimination limit with ts-rest
  return tsrClient.questionBank.bulkDeleteQuestions.useMutation({
    onSuccess: () => invalidateQuestionBankQueries(queryClient),
  });
}

export function useQuestionBankContractBulkRestore() {
  const queryClient = useQueryClient();
  // @ts-expect-error - TS union discrimination limit with ts-rest
  return tsrClient.questionBank.bulkRestoreQuestions.useMutation({
    onSuccess: () => invalidateQuestionBankQueries(queryClient),
  });
}

export function useQuestionBankContractDeleteQuestion() {
  const queryClient = useQueryClient();
  // @ts-expect-error - TS union discrimination limit with ts-rest
  return tsrClient.questionBank.deleteQuestion.useMutation({
    onSuccess: () => invalidateQuestionBankQueries(queryClient),
  });
}

export function useQuestionBankContractRestoreQuestion() {
  const queryClient = useQueryClient();
  // @ts-expect-error - TS union discrimination limit with ts-rest
  return tsrClient.questionBank.restoreQuestion.useMutation({
    onSuccess: () => invalidateQuestionBankQueries(queryClient),
  });
}
