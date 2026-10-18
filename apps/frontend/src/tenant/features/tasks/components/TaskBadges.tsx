import React from "react";
import { type TaskPriority, type TaskStatus, type AppTranslationKey } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { StatusBadge, type StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import { SEMANTIC_BADGE } from "@/lib/ui/semanticTone";

const PRIORITY_CLS: Record<TaskPriority, string> = {
  low: SEMANTIC_BADGE.muted,
  medium: SEMANTIC_BADGE.info,
  high: SEMANTIC_BADGE.warning,
  urgent: SEMANTIC_BADGE.destructive,
};

const STATUS_CLS: Record<TaskStatus, string> = {
  todo: SEMANTIC_BADGE.muted,
  in_progress: SEMANTIC_BADGE.info,
  in_review: SEMANTIC_BADGE.secondary,
  blocked: SEMANTIC_BADGE.destructive,
  completed: SEMANTIC_BADGE.success,
  cancelled: SEMANTIC_BADGE.muted,
};

function useTaskPriorityConfig(): Record<string, StatusBadgeConfigItem> {
  const { t } = useTranslation();
  return {
    low: { label: t("tasks.priority.low" as AppTranslationKey), cls: PRIORITY_CLS.low },
    medium: { label: t("tasks.priority.medium" as AppTranslationKey), cls: PRIORITY_CLS.medium },
    high: { label: t("tasks.priority.high" as AppTranslationKey), cls: PRIORITY_CLS.high },
    urgent: { label: t("tasks.priority.urgent" as AppTranslationKey), cls: PRIORITY_CLS.urgent },
  };
}

function useTaskStatusConfig(): Record<string, StatusBadgeConfigItem> {
  const { t } = useTranslation();
  return {
    todo: { label: t("tasks.status.todo" as AppTranslationKey), cls: STATUS_CLS.todo },
    in_progress: {
      label: t("tasks.status.in_progress" as AppTranslationKey),
      cls: STATUS_CLS.in_progress,
    },
    in_review: {
      label: t("tasks.status.in_review" as AppTranslationKey),
      cls: STATUS_CLS.in_review,
    },
    blocked: { label: t("tasks.status.blocked" as AppTranslationKey), cls: STATUS_CLS.blocked },
    completed: {
      label: t("tasks.status.completed" as AppTranslationKey),
      cls: STATUS_CLS.completed,
    },
    cancelled: {
      label: t("tasks.status.cancelled" as AppTranslationKey),
      cls: STATUS_CLS.cancelled,
    },
  };
}

export function TaskPriorityBadge({ priority }: { priority: TaskPriority }): React.JSX.Element {
  const config = useTaskPriorityConfig();
  return <StatusBadge status={priority} config={config} size="sm" />;
}

export function TaskStatusBadge({
  status,
  onClick,
}: {
  status: TaskStatus;
  onClick?: () => void;
}): React.JSX.Element {
  const config = useTaskStatusConfig();
  return <StatusBadge status={status} config={config} size="sm" onClick={onClick} />;
}
