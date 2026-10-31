/**
 * QuestionBank contract-driven server-state surface: list query options, contract
 * query hooks, and contract mutations.
 */
import { apiContract, tsrClient } from "@/lib/api";
import { queryOptions, useQueryClient } from "@tanstack/react-query";
import {
  QUESTION_BANK_QUESTIONS_QUERY_KEY,
  QUESTION_BANK_TESTS_QUERY_KEY,
  QUESTION_BANK_RESULTS_QUERY_KEY,
} from "./questionBankQueryKeys.js";
import { invalidateQuestionBankQueries } from "@/tenant/features/question-bank/hooks/invalidateQuestionBankQueries";
import { assertContractOk } from "@/lib/apiContractError";

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
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });
}

export function useQuestionBankContractList(query: Record<string, unknown> = {}, enabled = true) {
  return tsrClient.questionBank.listQuestions.useQuery({
    queryKey: [...QUESTION_BANK_QUESTIONS_QUERY_KEY, "contract-list", query],
    queryData: { query },
    staleTime: 15_000,
    enabled,
  });
}

export function useQuestionBankContractTests(enabled = true) {
  return tsrClient.questionBank.listTests.useQuery({
    queryKey: [...QUESTION_BANK_TESTS_QUERY_KEY, "contract-list"],
    queryData: { query: {} },
    staleTime: 30_000,
    enabled,
  });
}

export function useQuestionBankContractResults(enabled = true) {
  return tsrClient.questionBank.listResults.useQuery({
    queryKey: [...QUESTION_BANK_RESULTS_QUERY_KEY, "contract-list"],
    queryData: { query: {} },
    staleTime: 30_000,
    enabled,
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
