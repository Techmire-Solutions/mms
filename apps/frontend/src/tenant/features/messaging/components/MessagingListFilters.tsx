import React, { type JSX } from "react";
import { formatDateToIso, type ModuleColumnRegistryEntry } from "@mms/shared";
import { AlertTriangle, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MessagingFiltersMenuButton } from "./MessagingFiltersMenuButton";
import { WorkTaskToolbar } from "@/components/common/work";
import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { type ModuleColumnCustomizerLabels } from "@/components/app/ModuleColumnCustomizer";
import { formatShownMessagesLabel } from "../lib/messagingCounts";

export const MESSAGING_WORK_SEARCH_INPUT_ID = "messaging-work-search";

export interface MessagingListFiltersProps {
  viewMode: WorkDirectoryViewMode;
  onViewModeChange: (mode: WorkDirectoryViewMode) => void;
  search: string;
  onSearchChange: (value: string) => void;
  channel: "all" | "sms" | "whatsapp" | "email";
  onChannelChange: (channel: "all" | "sms" | "whatsapp" | "email") => void;
  channelOptions: Array<{ value: string; label: string }>;
  status: "all" | "sent" | "delivered" | "failed" | "skipped";
  onStatusChange: (status: "all" | "sent" | "delivered" | "failed" | "skipped") => void;
  statusOptions: Array<{ value: string; label: string }>;
  category: string;
  onCategoryChange: (category: string) => void;
  categoryOptions: Array<{ value: string; label: string }>;
  startDate: string;
  onStartDateChange: (date: string) => void;
  endDate: string;
  onEndDateChange: (date: string) => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  onClearFilters: () => void;
  columnRegistry?: ModuleColumnRegistryEntry[];
  updateUserColumnLayout?: (columns: ModuleColumnRegistryEntry[]) => void;
  onResetColumnLayout?: () => void;
  columnCustomizerLabels?: ModuleColumnCustomizerLabels;
  shownCount?: number;
  /** Total matching rows — makes the toolbar count read "N of M", not a page-only number. */
  shownTotal?: number;
  filterChips?: React.ReactNode;
  /** Archived (soft-deleted) logs view — only rendered for `messaging.clearLogs`. */
  showArchived?: boolean;
  onShowArchivedChange?: (value: boolean) => void;
}

export function MessagingListFilters({
  viewMode,
  onViewModeChange,
  search,
  filterChips,
  onSearchChange,
  channel,
  onChannelChange,
  channelOptions,
  status,
  onStatusChange,
  statusOptions,
  category,
  onCategoryChange,
  categoryOptions,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  hasActiveFilters,
  activeFilterCount,
  onClearFilters,
  columnRegistry,
  updateUserColumnLayout,
  onResetColumnLayout,
  columnCustomizerLabels,
  shownCount,
  shownTotal,
  showArchived = false,
  onShowArchivedChange,
}: MessagingListFiltersProps): JSX.Element {
  const { t } = useTranslation();

  // Local-calendar dates: `toISOString()` is UTC, so "today" would be yesterday
  // for every user east of UTC (Asia/Karachi is UTC+5).
  const handlePresetDate = (days: number): void => {
    const end = new Date();
    const start = new Date();
    if (days === 0) {
      const todayStr = formatDateToIso(end);
      onStartDateChange(todayStr);
      onEndDateChange(todayStr);
      return;
    }
    start.setDate(end.getDate() - days);
    onStartDateChange(formatDateToIso(start));
    onEndDateChange(formatDateToIso(end));
  };

  const clearDates = (): void => {
    onStartDateChange("");
    onEndDateChange("");
  };

  const isFailedOnly = status === "failed";

  return (
    <WorkTaskToolbar
      shownCountLabel={
        shownCount != null
          ? formatShownMessagesLabel(shownCount, shownTotal ?? shownCount, t)
          : undefined
      }
      regionLabel={t("messaging.title")}
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder={t("messaging.search.placeholder")}
      searchId="messaging-work-search"
      hasActiveFilters={hasActiveFilters}
      onClearFilters={onClearFilters}
      clearFiltersLabel={t("common.clearFilters")}
      filterChips={filterChips}
      filterButton={
        <MessagingFiltersMenuButton
          activeFilterCount={activeFilterCount}
          onClearFilters={onClearFilters}
          channel={channel}
          onChannelChange={onChannelChange}
          channelOptions={channelOptions}
          status={status}
          onStatusChange={onStatusChange}
          statusOptions={statusOptions}
          category={category}
          onCategoryChange={onCategoryChange}
          categoryOptions={categoryOptions}
          startDate={startDate}
          onStartDateChange={onStartDateChange}
          endDate={endDate}
          onEndDateChange={onEndDateChange}
          handlePresetDate={handlePresetDate}
          clearDates={clearDates}
          t={t}
        />
      }
      viewModeToggle={
        viewMode !== undefined && onViewModeChange !== undefined
          ? {
              viewMode: viewMode,
              onViewModeChange: onViewModeChange,
            }
          : undefined
      }
      columnCustomizer={
        columnRegistry && updateUserColumnLayout && columnCustomizerLabels
          ? {
              registry: columnRegistry,
              onUpdate: updateUserColumnLayout,
              onReset: onResetColumnLayout,
              labels: columnCustomizerLabels,
            }
          : undefined
      }
    >
      <Button
        variant={isFailedOnly ? "default" : "outline"}
        size="sm"
        aria-pressed={isFailedOnly}
        aria-label={
          isFailedOnly
            ? t("messaging.filters.showAllStatus")
            : t("messaging.filters.filterFailedOnly")
        }
        onClick={() => onStatusChange(isFailedOnly ? "all" : "failed")}
        className={cn(
          "gap-2 h-9",
          isFailedOnly
            ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 border-transparent shadow-sm"
            : "border-destructive/30 text-destructive hover:bg-destructive/10",
        )}
      >
        <AlertTriangle className="w-4 h-4" aria-hidden="true" />
        <span>{t("messaging.status.failed")}</span>
      </Button>

      {onShowArchivedChange ? (
        <Button
          variant={showArchived ? "default" : "outline"}
          size="sm"
          aria-pressed={showArchived}
          aria-label={t("messaging.showArchived")}
          onClick={() => onShowArchivedChange(!showArchived)}
          className="gap-2 h-9"
        >
          <Archive className="w-4 h-4" aria-hidden="true" />
          <span>{t("messaging.showArchived")}</span>
        </Button>
      ) : null}
    </WorkTaskToolbar>
  );
}
