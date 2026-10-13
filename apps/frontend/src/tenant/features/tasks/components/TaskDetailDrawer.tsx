/**
 * @file TaskDetailDrawer.tsx
 * @description Read-only task inspection drawer with archive restore/edit chrome.
 */

import React from "react";
import { formatDate, formatDateTime, type TaskRecord } from "@mms/shared";
import { Drawer } from "@/components/app/Drawer";
import {
  DetailDrawerArchivedBanner,
  DetailDrawerRestoreOrEditAction,
} from "@/components/app/DetailDrawerArchiveChrome";
import { DrawerUpdatedStamp } from "@/components/app/DrawerUpdatedStamp";
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
    <Drawer
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
        <div className="flex flex-wrap gap-2">
          <TaskStatusBadge status={task.status} />
          <TaskPriorityBadge priority={task.priority} />
        </div>
        {task.description ? (
          <p className="text-sm text-foreground text-wrap-pretty">{task.description}</p>
        ) : null}
        <dl className="grid gap-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{t("tasks.startDate")}</dt>
            <dd className="text-foreground">{task.startDate ? formatDate(task.startDate) : "—"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{t("tasks.dueAt")}</dt>
            <dd className="text-foreground">{task.dueAt ? formatDateTime(task.dueAt) : "—"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{t("tasks.parentTask")}</dt>
            <dd className="text-foreground text-end">{task.parentTaskId ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{t("tasks.assignees")}</dt>
            <dd className="text-foreground text-end">
              {task.assignees?.length
                ? task.assignees.map((a) => a.facultyName || t("tasks.assigneeFallback")).join(", ")
                : t("tasks.noAssignees")}
            </dd>
          </div>
        </dl>
      </div>
    </Drawer>
  );
}
