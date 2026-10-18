import { useCallback } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import type { useQuestionBankMutations } from "@/tenant/features/question-bank/hooks/useQuestionBankApi";

type QuestionBankTrashMutations = Pick<
  ReturnType<typeof useQuestionBankMutations>,
  "deleteQuestion" | "restoreQuestion" | "bulkDeleteQuestions" | "bulkRestoreQuestions"
>;

export function useQuestionBankTrashActions(mutations: QuestionBankTrashMutations) {
  const { t } = useTranslation();
  const { deleteQuestion, restoreQuestion, bulkDeleteQuestions, bulkRestoreQuestions } = mutations;

  const notifyTrashFailure = useCallback(
    (error: unknown) => {
      notify.error(t("questionBank.trash.actionFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    },
    [t],
  );

  const handleDeleteQuestion = async (id: string) => {
    try {
      await deleteQuestion.mutateAsync(id);
      notify.success(t("questionBank.trash.deleted"));
    } catch (error: unknown) {
      notifyTrashFailure(error);
      throw error;
    }
  };

  const handleRestoreQuestion = async (id: string) => {
    try {
      await restoreQuestion.mutateAsync(id);
      notify.success(t("questionBank.trash.restored"));
    } catch (error: unknown) {
      notifyTrashFailure(error);
      throw error;
    }
  };

  const handleBulkDelete = async (ids: string[]) => {
    try {
      const result = await bulkDeleteQuestions.mutateAsync(ids);
      if (result.failed > 0) {
        notify.warning(
          t("questionBank.trash.bulkPartial", {
            succeeded: result.succeeded,
            failed: result.failed,
          }),
        );
      } else if (result.succeeded > 1) {
        notify.success(t("questionBank.trash.bulkDeleted", { count: result.succeeded }));
      } else {
        notify.success(t("questionBank.trash.deleted"));
      }
    } catch (error: unknown) {
      notifyTrashFailure(error);
      throw error;
    }
  };

  const handleBulkRestore = async (ids: string[]) => {
    try {
      const result = await bulkRestoreQuestions.mutateAsync(ids);
      if (result.failed > 0) {
        notify.warning(
          t("questionBank.trash.bulkPartial", {
            succeeded: result.succeeded,
            failed: result.failed,
          }),
        );
      } else if (result.succeeded > 1) {
        notify.success(t("questionBank.trash.bulkRestored", { count: result.succeeded }));
      } else {
        notify.success(t("questionBank.trash.restored"));
      }
    } catch (error: unknown) {
      notifyTrashFailure(error);
      throw error;
    }
  };

  return {
    handleDeleteQuestion,
    handleRestoreQuestion,
    handleBulkDelete,
    handleBulkRestore,
  };
}
