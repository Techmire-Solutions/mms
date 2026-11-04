import React from "react";
import { Plus } from "lucide-react";
import { TASK_PRIORITIES, TASK_STATUSES } from "@mms/shared";
import {
  ModuleFilterCheckboxGroup,
  ModuleFilterDropdown,
} from "@/components/app/ModuleFiltersMenuButton";
import { FilterChips } from "@/components/app/FilterChips";
import { CompactSegmentedControl } from "@/components/app/CompactSegmentedControl";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import {
  WorkTaskToolbar,
  type WorkTaskToolbarProps,
} from "@/components/common/work/WorkTaskToolbar";
import type { CompactSegmentedOption } from "@/components/app/CompactSegmentedControl";
import type { FilterChip } from "@/components/app/FilterChips";
import { TASKS_WORK_SEARCH_INPUT_ID } from "../hooks/useTasksKeyboardShortcuts";
import type { TaskQuickFilter } from "../hooks/useTasksWorkTabFilters";

export interface TasksWorkToolbarProps {
  quickFilter: TaskQuickFilter;
  quickFilterOptions: CompactSegmentedOption<TaskQuickFilter>[];
  onQuickFilterChange: (value: TaskQuickFilter) => void;
  searchInput: string;
  onSearchChange: (value: string) => void;
  shownCount: number;
  statusFilter: string[];
  onStatusFilterChange: (update: (current: string[]) => string[]) => void;
  priorityFilter: string[];
  onPriorityFilterChange: (update: (current: string[]) => string[]) => void;
  onClearPriority: () => void;
  dueFrom?: string;
  dueTo?: string;
  onDueRangeChange: (range: { start?: string; end?: string }) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  activeChips: FilterChip[];
  trashToggle: WorkTaskToolbarProps["trashToggle"];
  viewMode: NonNullable<WorkTaskToolbarProps["viewModeToggle"]>["viewMode"];
  onViewModeChange: NonNullable<WorkTaskToolbarProps["viewModeToggle"]>["onViewModeChange"];
  columnCustomizer: NonNullable<WorkTaskToolbarProps["columnCustomizer"]>;
}

/**
 * Quick-filter pills + Work toolbar for the Tasks directory.
 * Split out of `TasksWorkTab` to keep the tier inside the 300-LOC ceiling.
 */
export function TasksWorkToolbar({
  quickFilter,
  quickFilterOptions,
  onQuickFilterChange,
  searchInput,
  onSearchChange,
  shownCount,
  statusFilter,
  onStatusFilterChange,
  priorityFilter,
  onPriorityFilterChange,
  onClearPriority,
  dueFrom,
  dueTo,
  onDueRangeChange,
  hasActiveFilters,
  onClearFilters,
  activeChips,
  trashToggle,
  viewMode,
  onViewModeChange,
  columnCustomizer,
}: TasksWorkToolbarProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <>
      <div className="overflow-x-auto pb-0.5">
        <CompactSegmentedControl<TaskQuickFilter>
          value={quickFilter}
          onChange={onQuickFilterChange}
          options={quickFilterOptions}
        />
      </div>

      <WorkTaskToolbar
        regionLabel={t("nav.tasks")}
        shownCountLabel={t("tasks.shownCount", { count: shownCount })}
        search={searchInput}
        onSearchChange={onSearchChange}
        searchId={TASKS_WORK_SEARCH_INPUT_ID}
        searchPlaceholder={t("tasks.searchPlaceholder")}
        statusFilter={{
          activeIds: statusFilter,
          options: TASK_STATUSES.map((status) => ({
            id: status,
            label: t(`tasks.status.${status}`),
          })),
          onToggle: (id) =>
            onStatusFilterChange((current) =>
              current.includes(id) ? current.filter((s) => s !== id) : [...current, id],
            ),
          allLabel: t("common.all"),
          onResetAll: () => onStatusFilterChange(() => []),
        }}
        dateRange={{
          startDate: dueFrom,
          endDate: dueTo,
          onDateRangeChange: onDueRangeChange,
          startPlaceholder: t("tasks.dateFrom"),
          endPlaceholder: t("tasks.dateTo"),
        }}
        filterButton={
          <ModuleFilterDropdown
            label={t("common.filters")}
            activeCount={priorityFilter.length}
            clearLabel={t("common.clearFilters")}
            onClear={onClearPriority}
          >
            <ModuleFilterCheckboxGroup
              label={t("tasks.priority")}
              options={TASK_PRIORITIES.map((priority) => ({
                value: priority,
                label: t(`tasks.priority.${priority}` as Parameters<typeof t>[0]),
              }))}
              selected={priorityFilter}
              onToggle={(value) =>
                onPriorityFilterChange((current) =>
                  current.includes(value)
                    ? current.filter((p) => p !== value)
                    : [...current, value],
                )
              }
            />
          </ModuleFilterDropdown>
        }
        hasActiveFilters={hasActiveFilters}
        onClearFilters={onClearFilters}
        clearFiltersLabel={t("common.clearFilters")}
        filterChips={<FilterChips chips={activeChips} onClearAll={onClearFilters} />}
        trashToggle={trashToggle}
        viewModeToggle={{ viewMode, onViewModeChange }}
        columnCustomizer={columnCustomizer}
        // Create lives in the page header and in the empty state — a toolbar
        // button here would be a second Add on the same screen.
        primaryAction={undefined}
      />
    </>
  );
}

/** Create CTA rendered as the empty directory action (honours `canWrite` and trash mode). */
export function TasksEmptyCreateAction({
  canWrite,
  viewingDeleted,
  onAddNew,
}: {
  canWrite: boolean;
  viewingDeleted: boolean;
  onAddNew: () => void;
}): React.JSX.Element | null {
  const { t } = useTranslation();
  if (!canWrite || viewingDeleted) return null;
  return (
    <Button variant="primary" icon={Plus} onClick={onAddNew}>
      {t("tasks.create")}
    </Button>
  );
}
