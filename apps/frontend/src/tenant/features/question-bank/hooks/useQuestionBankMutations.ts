import { useQueryClient } from "@tanstack/react-query";
import type { MutateOptions } from "@tanstack/react-query";
import type { QuestionBankQuestion, QuestionBankTest, QuestionBankResult } from "@mms/shared";
import { tsrClient } from "@/lib/api";
import {
  QUESTION_BANK_METRICS_QUERY_KEY,
  QUESTION_BANK_QUESTIONS_QUERY_KEY,
  QUESTION_BANK_RESULTS_QUERY_KEY,
  QUESTION_BANK_TESTS_QUERY_KEY,
} from "./useQuestionBankApi";

export function useQuestionBankMutations() {
  const queryClient = useQueryClient();

  const invalidateQuestions = () => {
    void queryClient.invalidateQueries({ queryKey: QUESTION_BANK_QUESTIONS_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: QUESTION_BANK_METRICS_QUERY_KEY });
  };

  const invalidate = () => {
    invalidateQuestions();
    void queryClient.invalidateQueries({ queryKey: QUESTION_BANK_TESTS_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: QUESTION_BANK_RESULTS_QUERY_KEY });
  };

  // @ts-expect-error - TS union discrimination limit with ts-rest
  const replaceQuestions = tsrClient.questionBank.bulkUpdateQuestions.useMutation({
    onSuccess: () => {
      invalidateQuestions();
    },
  });

  // @ts-expect-error - TS union discrimination limit with ts-rest
  const replaceTests = tsrClient.questionBank.bulkUpdateTests.useMutation({
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUESTION_BANK_TESTS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: QUESTION_BANK_METRICS_QUERY_KEY });
    },
  });

  // @ts-expect-error - TS union discrimination limit with ts-rest
  const replaceResults = tsrClient.questionBank.bulkUpdateResults.useMutation({
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUESTION_BANK_RESULTS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: QUESTION_BANK_METRICS_QUERY_KEY });
    },
  });

  // @ts-expect-error - TS union discrimination limit with ts-rest
  const deleteQuestion = tsrClient.questionBank.deleteQuestion.useMutation({
    onSuccess: () => invalidateQuestions(),
  });

  // @ts-expect-error - TS union discrimination limit with ts-rest
  const restoreQuestion = tsrClient.questionBank.restoreQuestion.useMutation({
    onSuccess: () => invalidateQuestions(),
  });

  // @ts-expect-error - TS union discrimination limit with ts-rest
  const bulkDeleteQuestions = tsrClient.questionBank.bulkDeleteQuestions.useMutation({
    onSuccess: () => invalidateQuestions(),
  });

  // @ts-expect-error - TS union discrimination limit with ts-rest
  const bulkRestoreQuestions = tsrClient.questionBank.bulkRestoreQuestions.useMutation({
    onSuccess: () => invalidateQuestions(),
  });

  return {
    replaceQuestions: {
      ...replaceQuestions,
      mutate: (questions: QuestionBankQuestion[], opts?: MutateOptions) =>
        replaceQuestions.mutate({ body: questions }, opts),
      mutateAsync: (questions: QuestionBankQuestion[]) =>
        replaceQuestions.mutateAsync({ body: questions }),
    },
    replaceTests: {
      ...replaceTests,
      mutate: (tests: QuestionBankTest[], opts?: MutateOptions) =>
        replaceTests.mutate({ body: tests }, opts),
      mutateAsync: (tests: QuestionBankTest[]) => replaceTests.mutateAsync({ body: tests }),
    },
    replaceResults: {
      ...replaceResults,
      mutate: (results: QuestionBankResult[], opts?: MutateOptions) =>
        replaceResults.mutate({ body: results }, opts),
      mutateAsync: (results: QuestionBankResult[]) => replaceResults.mutateAsync({ body: results }),
    },
    deleteQuestion: {
      ...deleteQuestion,
      mutate: (id: string, opts?: MutateOptions) => deleteQuestion.mutate({ params: { id } }, opts),
      mutateAsync: (id: string) => deleteQuestion.mutateAsync({ params: { id } }),
    },
    restoreQuestion: {
      ...restoreQuestion,
      mutate: (id: string, opts?: MutateOptions) =>
        restoreQuestion.mutate({ params: { id } }, opts),
      mutateAsync: (id: string) => restoreQuestion.mutateAsync({ params: { id } }),
    },
    bulkDeleteQuestions: {
      ...bulkDeleteQuestions,
      mutate: (ids: string[], opts?: MutateOptions) =>
        bulkDeleteQuestions.mutate({ body: { ids } }, opts),
      mutateAsync: (ids: string[]) => bulkDeleteQuestions.mutateAsync({ body: { ids } }),
    },
    bulkRestoreQuestions: {
      ...bulkRestoreQuestions,
      mutate: (ids: string[], opts?: MutateOptions) =>
        bulkRestoreQuestions.mutate({ body: { ids } }, opts),
      mutateAsync: (ids: string[]) => bulkRestoreQuestions.mutateAsync({ body: { ids } }),
    },
    invalidate,
  };
}
