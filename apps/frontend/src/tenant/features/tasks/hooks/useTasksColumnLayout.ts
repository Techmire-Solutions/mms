/**
 * @file useTasksColumnLayout.ts
 * @description Module column layout SSOT for Tasks Work directory.
 */

import { useMemo } from "react";
import {
  TASKS_MODULE_MANIFEST,
  resolveModuleColumnWidth,
  type AppTranslationKey,
  type ModuleColumnKind,
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

const TASK_WORK_COLUMN_KINDS: Record<(typeof TASK_WORK_COLUMN_KEYS)[number], ModuleColumnKind> = {
  title: "title",
  description: "longText",
  priority: "status",
  status: "status",
  assignees: "chips",
  dueAt: "date",
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
        kind: TASK_WORK_COLUMN_KINDS[key],
        width: resolveModuleColumnWidth(undefined, TASK_WORK_COLUMN_KINDS[key]),
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
