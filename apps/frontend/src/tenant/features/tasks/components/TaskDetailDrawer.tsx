/**
 * @file TaskDetailDrawer.tsx
 * @description Read-only task inspection drawer with archive restore/edit chrome.
 */

import React from "react";
import { formatDate, formatDateTime, type TaskRecord } from "@mms/shared";
import { DetailDrawerShell } from "@/components/app/DetailDrawerShell";
import {
  DetailDrawerArchivedBanner,
  DetailDrawerRestoreOrEditAction,
} from "@/components/app/DetailDrawerArchiveChrome";
import { DetailSectionTitle } from "@/components/app/DetailSectionTitle";
import { DetailAttributeRow } from "@/components/app/DetailAttributeRow";
import { DrawerUpdatedStamp } from "@/components/app/DrawerUpdatedStamp";
import { CopyBtn } from "@/components/app/CopyButton";
import { useTranslation } from "@/hooks/useTranslation";
import { TaskPriorityBadge, TaskStatusBadge } from "./TaskBadges";

export interface TaskDetailDrawerProps {
  task: TaskRecord | null;
  canWrite: boolean;
  canDelete: boolean;
  onClose: () => void;
  onEdit?: (task: TaskRecord) => void;
  onRestore?: (id: string) => void;
}

export function TaskDetailDrawer({
  task,
  canWrite,
  canDelete,
  onClose,
  onEdit,
  onRestore,
}: TaskDetailDrawerProps): React.JSX.Element | null {
  const { t } = useTranslation();
  if (!task) return null;

  const isArchived = Boolean(task.deletedAt);

  return (
    <DetailDrawerShell
      open
      onClose={onClose}
      title={task.title}
      headerActions={
        <DetailDrawerRestoreOrEditAction
          isArchived={isArchived}
          canRestore={canDelete}
          canEdit={canWrite && !isArchived}
          restoreLabel={t("tasks.restore")}
          editLabel={t("common.edit")}
          onRestore={onRestore ? () => onRestore(task.id) : undefined}
          onEdit={onEdit ? () => onEdit(task) : undefined}
        />
      }
      footer={
        <DrawerUpdatedStamp
          updatedAt={task.updatedAt}
          createdAt={task.createdAt}
          label={t("tasks.detail.updatedLabel")}
        />
      }
    >
      <div className="space-y-4 text-start">
        {isArchived ? (
          <DetailDrawerArchivedBanner
            deletedAt={task.deletedAt}
            title={t("common.archiveTitle", { title: task.title })}
          />
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <TaskStatusBadge status={task.status} />
            <TaskPriorityBadge priority={task.priority} />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-mono">{task.id.slice(0, 8)}</span>
            <CopyBtn text={task.id} showToast className="h-6 w-6 rounded-md" />
          </div>
        </div>
        {task.description ? (
          <p className="text-sm text-foreground text-wrap-pretty">{task.description}</p>
        ) : null}

        <div className="space-y-3 pt-1">
          <DetailSectionTitle>{t("common.details")}</DetailSectionTitle>
          <div className="space-y-1">
            <DetailAttributeRow
              variant="list"
              label={t("tasks.startDate")}
              value={task.startDate ? formatDate(task.startDate) : "—"}
            />
            <DetailAttributeRow
              variant="list"
              label={t("tasks.dueAt")}
              value={task.dueAt ? formatDateTime(task.dueAt) : "—"}
            />
            <DetailAttributeRow
              variant="list"
              label={t("tasks.parentTask")}
              value={task.parentTaskId ?? "—"}
            />
            <DetailAttributeRow
              variant="list"
              label={t("tasks.assignees")}
              value={
                task.assignees?.length
                  ? task.assignees
                      .map((a) => a.facultyName || t("tasks.assigneeFallback"))
                      .join(", ")
                  : t("tasks.noAssignees")
              }
            />
          </div>
        </div>
      </div>
    </DetailDrawerShell>
  );
}
