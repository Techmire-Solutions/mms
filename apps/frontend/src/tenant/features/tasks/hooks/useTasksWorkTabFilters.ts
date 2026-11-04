import { useMemo, useState } from "react";
import type { FilterChip } from "@/components/app/FilterChips";
import type { CompactSegmentedOption } from "@/components/app/CompactSegmentedControl";
import { useDebounce } from "@/hooks/useDebounce";
import { useTranslation } from "@/hooks/useTranslation";

/** Same leaf-debounce window the Contacts/Students/Faculty directories use. */
const SEARCH_DEBOUNCE_MS = 250;

export type TaskQuickFilter = "all" | "mine" | "open" | "due_today" | "urgent_high" | "overdue";

/**
 * Owns the Work-tier filter model only. Filtering itself happens on the server
 * (`buildTaskServerFilters` → `GET /api/tasks`); re-filtering the returned page
 * here would apply a second, different predicate set over already-filtered rows
 * and desynchronise the page from `total`.
 */
export function useTasksWorkTabFilters() {
  const { t } = useTranslation();
  const [quickFilter, setQuickFilter] = useState<TaskQuickFilter>("all");
  // Raw input stays in the leaf control; only the settled value reaches the
  // directory query, so typing does not fire one request per keystroke.
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounce(searchInput, SEARCH_DEBOUNCE_MS);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [dueFrom, setDueFrom] = useState<string | undefined>(undefined);
  const [dueTo, setDueTo] = useState<string | undefined>(undefined);

  const activeChips = useMemo<FilterChip[]>(() => {
    const list: FilterChip[] = [];

    if (quickFilter !== "all") {
      const quickFilterLabels: Record<TaskQuickFilter, string> = {
        all: t("common.all"),
        mine: t("tasks.quickFilter.mine"),
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

    for (const s of statusFilter) {
      list.push({
        key: `status-${s}`,
        label: `${t("tasks.status")}: ${t(`tasks.status.${s}` as Parameters<typeof t>[0])}`,
        onRemove: () => setStatusFilter((prev) => prev.filter((item) => item !== s)),
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
  }, [quickFilter, statusFilter, priorityFilter, dueFrom, dueTo, t]);

  // Every filter dimension the directory owns — including search, which has no
  // removable chip but must still enable "clear filters" and the Escape reset.
  const hasActiveFilters = activeChips.length > 0 || search.trim().length > 0;

  const handleClearFilters = () => {
    setQuickFilter("all");
    setStatusFilter([]);
    setPriorityFilter([]);
    setDueFrom(undefined);
    setDueTo(undefined);
    setSearchInput("");
  };

  const quickFilterOptions = useMemo<CompactSegmentedOption<TaskQuickFilter>[]>(
    () => [
      { value: "all", label: t("common.all") },
      { value: "mine", label: t("tasks.quickFilter.mine") },
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
    searchInput,
    setSearchInput,
    setSearch: setSearchInput,
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    dueFrom,
    setDueFrom,
    dueTo,
    setDueTo,
    activeChips,
    hasActiveFilters,
    handleClearFilters,
  };
}
