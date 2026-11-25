/**
 * @file TaskCardItem.tsx
 * @description Work directory card for a single task — DirectoryEntityCard SSOT (do not hand-compose EntityCard).
 */

import React from "react";
import { Pencil, Trash2, RotateCcw } from "lucide-react";
import { formatDate, type TaskRecord, type TaskStatus } from "@mms/contracts";
import { DataTableRowActions } from "@mms/fe-core/components/data-table";
import { DirectoryCardMetaTile } from "@mms/ui/app/DirectoryCardMetaTile";
import { DirectoryCardMetaGrid } from "@mms/ui/app/DirectoryCardMetaGrid";
import { DirectoryEntityCard } from "@mms/fe-core/components/DirectoryEntityCard";
import { BiDiText } from "@mms/ui/app/BiDiText";
import { useTranslation } from "@mms/fe-core/i18n";
import { TaskPriorityBadge } from "./TaskBadges";
import { TaskStatusMenu } from "./TaskStatusMenu";

export interface TaskCardItemProps {
  task: TaskRecord;
  selectedIds: string[];
  viewingDeleted: boolean;
  canWrite: boolean;
  canComplete?: boolean;
  statusPending?: boolean;
  canDelete: boolean;
  isColumnVisible: (key: string) => boolean;
  onToggleSelected: (id: string, checked: boolean) => void;
  onView: (task: TaskRecord) => void;
  onEdit: (task: TaskRecord) => void;
  onDelete: (id: string) => void;
  onRestore?: (id: string) => void;
  onUpdateStatus: (task: TaskRecord, status: TaskStatus) => void;
  reducedMotion?: boolean;
}

/** Work directory card — DirectoryEntityCard SSOT (do not hand-compose EntityCard). */
export function TaskCardItem({
  task,
  selectedIds,
  viewingDeleted,
  canWrite,
  canComplete,
  statusPending = false,
  canDelete,
  isColumnVisible,
  onToggleSelected,
  onView,
  onEdit,
  onDelete,
  onRestore,
  onUpdateStatus,
  reducedMotion = false,
}: TaskCardItemProps): React.JSX.Element {
  const { t } = useTranslation();

  const assigneeLabel = task.assignees?.length
    ? task.assignees.map((a) => a.facultyName || t("tasks.assigneeFallback")).join(", ")
    : t("tasks.noAssignees");

  const actions = [];
  if (viewingDeleted && canDelete && onRestore) {
    actions.push({
      id: "restore",
      label: t("tasks.restore"),
      icon: RotateCcw,
      onClick: () => onRestore(task.id),
    });
  } else {
    if (canWrite) {
      actions.push({
        id: "edit",
        label: t("tasks.edit"),
        icon: Pencil,
        onClick: () => onEdit(task),
      });
    }
    if (canDelete) {
      actions.push({
        id: "delete",
        label: t("tasks.delete"),
        icon: Trash2,
        tone: "destructive" as const,
        onClick: () => onDelete(task.id),
      });
    }
  }

  return (
    <DirectoryEntityCard
      entity={task}
      selectedIds={selectedIds}
      canSelect={canWrite || canDelete}
      onToggleSelected={onToggleSelected}
      onView={onView}
      onEdit={onEdit}
      reducedMotion={reducedMotion}
      header={{
        displayName: task.title,
        subtitle: isColumnVisible("priority") ? (
          <TaskPriorityBadge priority={task.priority} />
        ) : undefined,
      }}
      viewLabel={t("tasks.actionViewShort")}
      viewAriaLabel={t("tasks.viewTask", { name: task.title })}
      metadataSlot={
        <DirectoryCardMetaGrid>
          {isColumnVisible("status") ? (
            <DirectoryCardMetaTile label={t("tasks.status")}>
              <TaskStatusMenu
                task={task}
                canChange={Boolean(canComplete ?? canWrite) && !viewingDeleted}
                pending={statusPending}
                onChangeStatus={onUpdateStatus}
              />
            </DirectoryCardMetaTile>
          ) : null}
          {isColumnVisible("description") ? (
            <DirectoryCardMetaTile label={t("tasks.description")}>
              <BiDiText className="text-wrap-pretty">{task.description?.trim() || "—"}</BiDiText>
            </DirectoryCardMetaTile>
          ) : null}
          {isColumnVisible("assignees") ? (
            <DirectoryCardMetaTile label={t("tasks.assignees")}>
              <BiDiText className="text-wrap-pretty">{assigneeLabel}</BiDiText>
            </DirectoryCardMetaTile>
          ) : null}
          {isColumnVisible("dueAt") ? (
            <DirectoryCardMetaTile label={t("tasks.dueAt")}>
              {task.dueAt ? formatDate(task.dueAt) : t("tasks.noDueDate")}
            </DirectoryCardMetaTile>
          ) : null}
        </DirectoryCardMetaGrid>
      }
      overflowActions={actions.length > 0 ? <DataTableRowActions actions={actions} /> : null}
    />
  );
}
