/**
 * QuestionBank contract-driven server-state surface: list query options, contract
 * query hooks, and contract mutations.
 */
import { apiContract, tsrClient } from "@mms/fe-core/api/tsRest";
import { keepPreviousData, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@mms/fe-core/auth/AuthContext";
import {
  QUESTION_BANK_QUESTIONS_QUERY_KEY,
  QUESTION_BANK_TESTS_QUERY_KEY,
  QUESTION_BANK_RESULTS_QUERY_KEY,
} from "./questionBankQueryKeys.js";
import { invalidateQuestionBankQueries } from "./invalidateQuestionBankQueries";
import { assertContractOk } from "@mms/fe-core/api/contractError";

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
      assertContractOk(response, "Failed to fetch question bank questions");
      return response.body;
    },
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function useQuestionBankContractList(query: Record<string, unknown> = {}, enabled = true) {
  const { isAuthenticated } = useAuth();
  return tsrClient.questionBank.listQuestions.useQuery({
    queryKey: [...QUESTION_BANK_QUESTIONS_QUERY_KEY, "contract-list", query],
    queryData: { query },
    staleTime: 15_000,
    enabled: isAuthenticated && enabled,
  });
}

export function useQuestionBankContractTests(enabled = true) {
  const { isAuthenticated } = useAuth();
  return tsrClient.questionBank.listTests.useQuery({
    queryKey: [...QUESTION_BANK_TESTS_QUERY_KEY, "contract-list"],
    queryData: { query: {} },
    staleTime: 30_000,
    enabled: isAuthenticated && enabled,
  });
}

export function useQuestionBankContractResults(enabled = true) {
  const { isAuthenticated } = useAuth();
  return tsrClient.questionBank.listResults.useQuery({
    queryKey: [...QUESTION_BANK_RESULTS_QUERY_KEY, "contract-list"],
    queryData: { query: {} },
    staleTime: 30_000,
    enabled: isAuthenticated && enabled,
  });
}

export function useQuestionBankContractBulkDelete() {
  const queryClient = useQueryClient();
  return tsrClient.questionBank.bulkDeleteQuestions.useMutation({
    onSuccess: () => invalidateQuestionBankQueries(queryClient),
  });
}

export function useQuestionBankContractBulkRestore() {
  const queryClient = useQueryClient();
  return tsrClient.questionBank.bulkRestoreQuestions.useMutation({
    onSuccess: () => invalidateQuestionBankQueries(queryClient),
  });
}

export function useQuestionBankContractDeleteQuestion() {
  const queryClient = useQueryClient();
  return tsrClient.questionBank.deleteQuestion.useMutation({
    onSuccess: () => invalidateQuestionBankQueries(queryClient),
  });
}

export function useQuestionBankContractRestoreQuestion() {
  const queryClient = useQueryClient();
  return tsrClient.questionBank.restoreQuestion.useMutation({
    onSuccess: () => invalidateQuestionBankQueries(queryClient),
  });
}
