import { useQueryClient } from "@tanstack/react-query";
import type { MutateOptions } from "@tanstack/react-query";
import type { QuestionBankQuestion, QuestionBankTest, QuestionBankResult } from "@mms/shared";
import { tsrClient } from "@/lib/api";
import { invalidateQuestionBankQueries } from "./invalidateQuestionBankQueries";

export function useQuestionBankMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    invalidateQuestionBankQueries(queryClient);
  };

  const replaceQuestions = tsrClient.questionBank.bulkUpdateQuestions.useMutation({
    onSuccess: () => invalidateQuestionBankQueries(queryClient),
  });

  const replaceTests = tsrClient.questionBank.bulkUpdateTests.useMutation({
    onSuccess: () => invalidateQuestionBankQueries(queryClient),
  });

  const replaceResults = tsrClient.questionBank.bulkUpdateResults.useMutation({
    onSuccess: () => invalidateQuestionBankQueries(queryClient),
  });

  const deleteQuestion = tsrClient.questionBank.deleteQuestion.useMutation({
    onSuccess: () => invalidateQuestionBankQueries(queryClient),
  });

  const restoreQuestion = tsrClient.questionBank.restoreQuestion.useMutation({
    onSuccess: () => invalidateQuestionBankQueries(queryClient),
  });

  const bulkDeleteQuestions = tsrClient.questionBank.bulkDeleteQuestions.useMutation({
    onSuccess: () => invalidateQuestionBankQueries(queryClient),
  });

  const bulkRestoreQuestions = tsrClient.questionBank.bulkRestoreQuestions.useMutation({
    onSuccess: () => invalidateQuestionBankQueries(queryClient),
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
