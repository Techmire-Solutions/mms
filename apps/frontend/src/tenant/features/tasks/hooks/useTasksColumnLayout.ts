/**
 * @file useTasksColumnLayout.ts
 * @description Module column layout SSOT for Tasks Work directory.
 */

import { useMemo } from "react";
import {
  TASKS_MODULE_MANIFEST,
  type AppTranslationKey,
  type ModuleColumnRegistryEntry,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useModuleColumnLayout } from "@/hooks/useModuleColumnLayout";

const TASK_WORK_COLUMN_KEYS = [
  "title",
  "description",
  "priority",
  "status",
  "assignees",
  "dueAt",
] as const;

const TASK_WORK_COLUMN_WIDTHS: Record<(typeof TASK_WORK_COLUMN_KEYS)[number], number | undefined> =
  {
    title: undefined,
    description: 220,
    priority: 120,
    status: 140,
    assignees: undefined,
    dueAt: 120,
  };

const TASK_WORK_COLUMN_LABEL_KEYS: Record<
  (typeof TASK_WORK_COLUMN_KEYS)[number],
  AppTranslationKey
> = {
  title: "tasks.title",
  description: "tasks.description",
  priority: "tasks.priority",
  status: "tasks.status",
  assignees: "tasks.assignees",
  dueAt: "tasks.dueAt",
};

export function useTasksColumnLayout() {
  const { t } = useTranslation();

  const tenantRegistry = useMemo<ModuleColumnRegistryEntry[]>(
    () =>
      TASK_WORK_COLUMN_KEYS.map((key, order) => ({
        key,
        label: t(TASK_WORK_COLUMN_LABEL_KEYS[key]),
        enabled: true,
        order,
        width: TASK_WORK_COLUMN_WIDTHS[key],
        fixed: key === "title",
      })),
    [t],
  );

  return useModuleColumnLayout({
    moduleId: TASKS_MODULE_MANIFEST.moduleId,
    tenantRegistry,
    translationPrefix: "common.columns",
  });
}
