/**
 * @file TaskStatusMenu.tsx
 * @description Status badge with a menu of legal workflow transitions.
 *
 * Replaces the old one-click badge cycle: terminal reopens are explicit menu
 * choices and the options come from the shared transition table.
 */
import React from "react";
import { ChevronDown } from "lucide-react";
import { taskStatusTransitionsFrom, type TaskRecord, type TaskStatus } from "@mms/shared";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/hooks/useTranslation";
import { TaskStatusBadge, useTaskStatusConfig } from "./TaskBadges";

export interface TaskStatusMenuProps {
  task: TaskRecord;
  canChange: boolean;
  pending?: boolean;
  onChangeStatus: (task: TaskRecord, status: TaskStatus) => void;
}

export function TaskStatusMenu({
  task,
  canChange,
  pending = false,
  onChangeStatus,
}: TaskStatusMenuProps): React.JSX.Element {
  const { t } = useTranslation();
  const statusConfig = useTaskStatusConfig();
  const badge = <TaskStatusBadge status={task.status} />;
  if (!canChange) return badge;

  const options = taskStatusTransitionsFrom(task.status);
  if (options.length === 0) return badge;

  return (
    <span className="inline-flex items-center gap-1">
      {badge}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={pending}
            aria-label={t("tasks.bulkStatus")}
          >
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {options.map((status) => (
            <DropdownMenuItem key={status} onSelect={() => onChangeStatus(task, status)}>
              {statusConfig[status]?.label ?? status}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}
