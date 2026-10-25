/**
 * @file tasksWorkBatchColumns.tsx
 * @description WorkBatchTable column definitions for Tasks Work directory.
 */

import { User as UserIcon } from "lucide-react";
import { formatDate, type TaskRecord, type TaskStatus, type AppTranslationKey } from "@mms/shared";
import type { WorkBatchTableColumn } from "@/components/common/work/WorkBatchTable";
import { TableCellLink } from "@shared/ui";
import { TaskPriorityBadge, TaskStatusBadge } from "./TaskBadges";

export const TASK_NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  todo: "in_progress",
  in_progress: "in_review",
  in_review: "completed",
  blocked: "in_progress",
  completed: "todo",
  cancelled: "todo",
};

export function buildTasksWorkBatchColumns(
  t: (key: AppTranslationKey) => string,
  canWrite: boolean,
  onCycleStatus: (task: TaskRecord) => void,
  onView: (task: TaskRecord) => void,
  options?: {
    isColumnVisible?: (key: string) => boolean;
    getColumnWidth?: (key: string) => number | undefined;
  },
): WorkBatchTableColumn<TaskRecord>[] {
  const isVisible = options?.isColumnVisible ?? (() => true);
  const widthOf = options?.getColumnWidth;

  const columns: WorkBatchTableColumn<TaskRecord>[] = [
    {
      id: "title",
      label: t("tasks.title"),
      width: widthOf?.("title"),
      render: (task) => (
        <TableCellLink tap className="text-start font-medium" onClick={() => onView(task)}>
          {task.title}
        </TableCellLink>
      ),
    },
    {
      id: "description",
      label: t("tasks.description"),
      width: widthOf?.("description") ?? 220,
      render: (task) =>
        task.description ? (
          <div className="text-xs text-muted-foreground line-clamp-2">{task.description}</div>
        ) : (
          <span className="text-muted-foreground/60 text-xs">—</span>
        ),
    },
    {
      id: "priority",
      label: t("tasks.priority"),
      width: widthOf?.("priority") ?? 120,
      noWrap: true,
      render: (task) => <TaskPriorityBadge priority={task.priority} />,
    },
    {
      id: "status",
      label: t("tasks.status"),
      width: widthOf?.("status") ?? 140,
      noWrap: true,
      render: (task) => (
        <TaskStatusBadge
          status={task.status}
          onClick={canWrite ? () => onCycleStatus(task) : undefined}
        />
      ),
    },
    {
      id: "assignees",
      label: t("tasks.assignees"),
      width: widthOf?.("assignees"),
      truncate: true,
      render: (task) =>
        task.assignees?.length ? (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <UserIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">
              {task.assignees.map((a) => a.facultyName || t("tasks.assigneeFallback")).join(", ")}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground/60 text-xs">{t("tasks.noAssignees")}</span>
        ),
    },
    {
      id: "dueAt",
      label: t("tasks.dueAt"),
      width: widthOf?.("dueAt") ?? 120,
      noWrap: true,
      render: (task) => {
        if (!task.dueAt) return <span className="text-muted-foreground/60 text-xs">—</span>;
        const isOverdue =
          task.status !== "completed" &&
          task.status !== "cancelled" &&
          new Date(task.dueAt) < new Date();
        return (
          <span
            className={
              isOverdue ? "text-destructive font-medium text-xs" : "text-muted-foreground text-xs"
            }
          >
            {formatDate(task.dueAt)}
          </span>
        );
      },
    },
  ];

  return columns.filter((column) => column.id === "title" || isVisible(column.id));
}
