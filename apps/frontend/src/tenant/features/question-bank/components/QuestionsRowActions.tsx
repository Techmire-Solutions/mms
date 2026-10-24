import type { JSX } from "react";
import { ModuleRowActionsMenu } from "@/components/app/ModuleRowActionsMenu";
import { useTranslation } from "@/hooks/useTranslation";
import type { QuestionBankQuestion as Question } from "@mms/shared";

export interface QuestionsRowActionsProps {
  question: Question;
  canWrite: boolean;
  canDelete: boolean;
  canTrashRows: boolean;
  showDeleted: boolean;
  /** When true, omit the View item (cards expose a header/View control). */
  hideViewItem?: boolean;
  triggerClassName?: string;
  onEditQuestion: (question: Question) => void;
  onTrashAction: (id: string) => void;
}

/**
 * Question Bank row/card actions — thin adapter over the shared
 * {@link ModuleRowActionsMenu}; Edit is the module's primary item and Archive /
 * Restore route to the trash action.
 */
export function QuestionsRowActions({
  question,
  canWrite,
  canDelete,
  canTrashRows,
  showDeleted,
  hideViewItem = false,
  triggerClassName,
  onEditQuestion,
  onTrashAction,
}: QuestionsRowActionsProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <ModuleRowActionsMenu
      triggerLabel={t("questionBank.table.actions")}
      editLabel={t("questionBank.editQuestion")}
      deleteLabel={t("common.delete")}
      restoreLabel={t("questionBank.trash.restore")}
      archived={showDeleted}
      canWrite={canWrite}
      canDelete={canDelete && canTrashRows}
      onView={undefined}
      onEdit={canWrite && !showDeleted ? () => onEditQuestion(question) : undefined}
      onDelete={() => onTrashAction(question.id)}
      onRestore={showDeleted && canTrashRows ? () => onTrashAction(question.id) : undefined}
      hideViewItem={hideViewItem}
      triggerClassName={triggerClassName}
    />
  );
}
