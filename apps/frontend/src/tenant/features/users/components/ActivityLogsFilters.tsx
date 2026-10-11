import React from "react";
import { ACTIVITY_ACTION_VALUES, type SystemUser } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { DateRangeFilterBar } from "@/components/ui/DateRangeFilterBar";
import { WorkTaskToolbar } from "@/components/common/work";
import { toColumnCustomizer, type DataTableColumnLayout } from "@/components/common/data-table";
import {
  ModuleFilterDivider,
  ModuleFilterDropdown,
  ModuleFilterRadioGroup,
} from "@/components/ui/ModuleFiltersMenuButton";
import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import { Button } from "@/components/ui/button";
import { calculateReportDateRange } from "@/lib/reports/reportDateUtils";

export interface ActivityLogsFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  userFilter: string;
  onUserFilterChange: (value: string) => void;
  actionFilter: string;
  onActionFilterChange: (value: string) => void;
  dateFrom: string;
  onDateFromChange: (value: string) => void;
  dateTo: string;
  onDateToChange: (value: string) => void;
  users: SystemUser[];
  viewMode: WorkDirectoryViewMode;
  onViewModeChange: (mode: WorkDirectoryViewMode) => void;
  columnLayout?: DataTableColumnLayout;
}

export function ActivityLogsFilters({
  search,
  onSearchChange,
  userFilter,
  onUserFilterChange,
  actionFilter,
  onActionFilterChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  users,
  viewMode,
  onViewModeChange,
  columnLayout,
}: ActivityLogsFiltersProps): React.JSX.Element {
  const { t } = useTranslation();

  const userOptions = (() => [
    { value: "all", label: t("users.activityAllUsers") },
    ...users.map((user) => ({ value: user.id, label: user.name })),
  ])();

  const actionOptions = (() => [
    { value: "all", label: t("users.activityAllActions") },
    ...ACTIVITY_ACTION_VALUES.map((activityAction) => ({
      value: activityAction,
      label: t(
        `users.action.${activityAction === "login_failed" ? "loginFailed" : activityAction === "role_change" ? "roleChange" : activityAction}`,
      ),
    })),
  ])();

  const applyPreset = (days?: number) => {
    const preset =
      days === undefined
        ? "none"
        : days === 0
          ? "today"
          : days === 7
            ? "7d"
            : days === 30
              ? "30d"
              : "none";
    const range = calculateReportDateRange(preset);
    onDateFromChange(range.from);
    onDateToChange(range.to);
  };

  const activeFilterCount =
    Number(userFilter !== "all") +
    Number(actionFilter !== "all") +
    Number(Boolean(dateFrom || dateTo));
  const clearFilters = () => {
    onSearchChange("");
    onUserFilterChange("all");
    onActionFilterChange("all");
    onDateFromChange("");
    onDateToChange("");
  };

  return (
    <WorkTaskToolbar
      regionLabel={t("users.activity")}
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder={t("users.activitySearch")}
      searchId="users-activity-search"
      hasActiveFilters={activeFilterCount > 0 || search.length > 0}
      onClearFilters={clearFilters}
      clearFiltersLabel={t("common.clearFilters")}
      filterButton={
        <ModuleFilterDropdown
          label={t("common.filters")}
          activeCount={activeFilterCount}
          clearLabel={t("common.clearFilters")}
          onClear={clearFilters}
        >
          <ModuleFilterRadioGroup
            label={t("users.activityFilterUser")}
            value={userFilter}
            onValueChange={onUserFilterChange}
            options={userOptions}
          />
          <ModuleFilterDivider />
          <ModuleFilterRadioGroup
            label={t("users.activityFilterAction")}
            value={actionFilter}
            onValueChange={onActionFilterChange}
            options={actionOptions}
          />
        </ModuleFilterDropdown>
      }
      viewModeToggle={{ viewMode, onViewModeChange }}
      columnCustomizer={toColumnCustomizer(columnLayout)}
    >
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant={!dateFrom && !dateTo ? "secondary" : "ghost"}
          size="sm"
          className="h-8 px-2 text-xs"
          onClick={() => applyPreset(undefined)}
        >
          {t("common.none")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs"
          onClick={() => applyPreset(0)}
        >
          {t("datePicker.today")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs"
          onClick={() => applyPreset(7)}
        >
          {t("messaging.datePreset7d")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs"
          onClick={() => applyPreset(30)}
        >
          {t("messaging.datePreset30d")}
        </Button>
      </div>
      <DateRangeFilterBar
        idPrefix="activity-logs"
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={onDateFromChange}
        onDateToChange={onDateToChange}
        pickerClassName="w-full min-w-0 text-sm sm:w-36"
      />
    </WorkTaskToolbar>
  );
}
