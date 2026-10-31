import { useMemo, useState } from "react";
import type { TaskRecord } from "@mms/shared";
import type { FilterChip } from "@/components/app/FilterChips";
import type { CompactSegmentedOption } from "@/components/app/CompactSegmentedControl";
import { useTranslation } from "@/hooks/useTranslation";

export type TaskQuickFilter = "all" | "open" | "due_today" | "urgent_high" | "overdue";

export function useTasksWorkTabFilters(tasks: TaskRecord[]) {
  const { t } = useTranslation();
  const [quickFilter, setQuickFilter] = useState<TaskQuickFilter>("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [dueFrom, setDueFrom] = useState<string | undefined>(undefined);
  const [dueTo, setDueTo] = useState<string | undefined>(undefined);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    const today = new Date().toISOString().slice(0, 10);

    return tasks.filter((task) => {
      if (quickFilter === "open") {
        if (task.status === "completed" || task.status === "cancelled") return false;
      } else if (quickFilter === "due_today") {
        if (!task.dueAt) return false;
        const taskDueDate = (
          task.dueAt instanceof Date ? task.dueAt.toISOString() : String(task.dueAt)
        ).slice(0, 10);
        if (taskDueDate !== today) return false;
      } else if (quickFilter === "urgent_high") {
        if (task.priority !== "urgent" && task.priority !== "high") return false;
      } else if (quickFilter === "overdue") {
        if (!task.dueAt) return false;
        const taskDueDate = (
          task.dueAt instanceof Date ? task.dueAt.toISOString() : String(task.dueAt)
        ).slice(0, 10);
        if (taskDueDate >= today || task.status === "completed" || task.status === "cancelled") {
          return false;
        }
      }

      if (statusFilter.length > 0 && !statusFilter.includes(task.status)) return false;
      if (priorityFilter.length > 0 && !priorityFilter.includes(task.priority)) return false;
      if (dueFrom || dueTo) {
        if (!task.dueAt) return false;
        const taskDueDate = (
          task.dueAt instanceof Date ? task.dueAt.toISOString() : String(task.dueAt)
        ).slice(0, 10);
        if (dueFrom && taskDueDate < dueFrom) return false;
        if (dueTo && taskDueDate > dueTo) return false;
      }
      if (!q) return true;
      const haystack = `${task.title} ${task.description ?? ""} ${
        task.assignees?.map((a) => a.facultyName).join(" ") ?? ""
      }`.toLowerCase();
      return haystack.includes(q);
    });
  }, [tasks, search, quickFilter, statusFilter, priorityFilter, dueFrom, dueTo]);

  const activeChips = useMemo<FilterChip[]>(() => {
    const list: FilterChip[] = [];

    if (quickFilter !== "all") {
      const quickFilterLabels: Record<TaskQuickFilter, string> = {
        all: t("common.all"),
        open: t("tasks.quickFilter.open"),
        due_today: t("tasks.quickFilter.dueToday"),
        urgent_high: t("tasks.quickFilter.urgentHigh"),
        overdue: t("tasks.quickFilter.overdue"),
      };
      list.push({
        key: "quickFilter",
        label: quickFilterLabels[quickFilter],
        onRemove: () => setQuickFilter("all"),
      });
    }

    for (const p of priorityFilter) {
      list.push({
        key: `priority-${p}`,
        label: `${t("tasks.priority")}: ${t(`tasks.priority.${p}` as Parameters<typeof t>[0])}`,
        onRemove: () => setPriorityFilter((prev) => prev.filter((item) => item !== p)),
      });
    }
    if (dueFrom) {
      list.push({
        key: "dueFrom",
        label: `${t("tasks.dateFrom")}: ${dueFrom}`,
        onRemove: () => setDueFrom(undefined),
      });
    }
    if (dueTo) {
      list.push({
        key: "dueTo",
        label: `${t("tasks.dateTo")}: ${dueTo}`,
        onRemove: () => setDueTo(undefined),
      });
    }
    return list;
  }, [quickFilter, priorityFilter, dueFrom, dueTo, t]);

  const handleClearFilters = () => {
    setQuickFilter("all");
    setPriorityFilter([]);
    setDueFrom(undefined);
    setDueTo(undefined);
  };

  const quickFilterOptions = useMemo<CompactSegmentedOption<TaskQuickFilter>[]>(
    () => [
      { value: "all", label: t("common.all") },
      { value: "open", label: t("tasks.quickFilter.open") },
      { value: "due_today", label: t("tasks.quickFilter.dueToday") },
      { value: "urgent_high", label: t("tasks.quickFilter.urgentHigh") },
      { value: "overdue", label: t("tasks.quickFilter.overdue") },
    ],
    [t],
  );

  return {
    quickFilter,
    setQuickFilter,
    quickFilterOptions,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    dueFrom,
    setDueFrom,
    dueTo,
    setDueTo,
    filteredTasks,
    activeChips,
    handleClearFilters,
  };
}
