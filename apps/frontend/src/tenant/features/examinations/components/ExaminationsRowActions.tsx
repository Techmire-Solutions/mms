import React from "react";
import { ModuleRowActionsMenu } from "@/components/ui/ModuleRowActionsMenu";
import { useTranslation } from "@/hooks/useTranslation";
import type { Exam } from "@mms/shared";

export interface ExaminationsRowActionsProps {
  exam: Exam;
  canWrite: boolean;
  canDelete: boolean;
  showDeleted: boolean;
  triggerClassName?: string;
  onEdit: (exam: Exam) => void;
  onTrashAction: (id: string) => void;
}

/**
 * Examinations row/card actions — thin adapter over the shared
 * {@link ModuleRowActionsMenu}; Edit is the module's primary item and Archive /
 * Restore route to the trash action.
 */
export function ExaminationsRowActions({
  exam,
  canWrite,
  canDelete,
  showDeleted,
  triggerClassName,
  onEdit,
  onTrashAction,
}: ExaminationsRowActionsProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <ModuleRowActionsMenu
      triggerLabel={t("examinations.table.actions")}
      editLabel={t("common.edit")}
      deleteLabel={t("common.delete")}
      restoreLabel={t("examinations.trash.restore")}
      archived={showDeleted}
      canWrite={canWrite}
      canDelete={canDelete}
      onView={undefined}
      onEdit={canWrite && !showDeleted ? () => onEdit(exam) : undefined}
      onDelete={() => onTrashAction(exam.id)}
      onRestore={showDeleted && canDelete ? () => onTrashAction(exam.id) : undefined}
      hideViewItem
      triggerClassName={triggerClassName}
    />
  );
}
