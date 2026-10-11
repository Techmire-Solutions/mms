import { Download } from "lucide-react";
import type { AppTranslationKey } from "@mms/shared";
import { Button } from "@/components/ui/button";
import { FilterChips } from "@/components/ui/FilterChips";
import { type ModuleColumnCustomizerProps } from "@/components/ui/ModuleColumnCustomizer";
import { WorkTaskToolbar } from "@/components/common/work";
import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import { SubTabBar } from "@/components/ui/SubTabBar";
import { useTranslation } from "@/hooks/useTranslation";
import { AccountingFiltersMenuButton } from "@/tenant/features/accounting/components/AccountingFiltersMenuButton";
import { getJournalTagLabel } from "@/tenant/features/accounting/components/journalEntriesListShared";

export const ACCOUNTING_WORK_SEARCH_INPUT_ID = "accounting-work-search";

type JournalMode = "simple" | "advanced";

interface JournalEntriesListFiltersProps {
  viewMode: WorkDirectoryViewMode;
  onViewModeChange: (mode: WorkDirectoryViewMode) => void;
  mode: JournalMode;
  modeTabs: Array<{ key: JournalMode; label: string }>;
  search: string;
  statusFilter: string;
  tagFilter: string;
  showFilters: boolean;
  canWrite: boolean;
  canDelete?: boolean;
  showDeleted: boolean;
  onToggleDeleted?: () => void;
  columnCustomizer?: ModuleColumnCustomizerProps;
  onModeChange: (mode: JournalMode) => void;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onTagFilterChange: (value: string) => void;
  onShowFiltersChange: (showFilters: boolean) => void;
  onOpenNew: () => void;
  onExportCsv: () => void;
}

export function JournalEntriesListFilters({
  viewMode,
  onViewModeChange,
  mode,
  modeTabs,
  search,
  statusFilter,
  tagFilter,
  showFilters,
  canWrite,
  canDelete = false,
  showDeleted,
  onToggleDeleted,
  columnCustomizer,
  onModeChange,
  onSearchChange,
  onStatusFilterChange,
  onTagFilterChange,
  onShowFiltersChange,
  onOpenNew,
  onExportCsv,
}: JournalEntriesListFiltersProps) {
  const { t } = useTranslation();
  const activeFilterCount = (statusFilter !== "all" ? 1 : 0) + (tagFilter !== "all" ? 1 : 0);
  const chips = [
    ...(statusFilter !== "all"
      ? [
          {
            key: `status:${statusFilter}`,
            label: t(`accounting.journal.status.${statusFilter}` as AppTranslationKey),
            onRemove: () => onStatusFilterChange("all"),
          },
        ]
      : []),
    ...(tagFilter !== "all"
      ? [
          {
            key: `tag:${tagFilter}`,
            label: getJournalTagLabel(tagFilter, t),
            onRemove: () => onTagFilterChange("all"),
          },
        ]
      : []),
  ];

  return (
    <>
      <SubTabBar
        tabs={modeTabs}
        value={mode}
        onChange={onModeChange}
        panelIdPrefix="journal-mode-advanced"
      />
      <WorkTaskToolbar
        regionLabel={t("nav.accounting")}
        search={search}
        onSearchChange={onSearchChange}
        searchPlaceholder={t("accounting.journal.dashboard.searchPlaceholder")}
        searchId={ACCOUNTING_WORK_SEARCH_INPUT_ID}
        hasActiveFilters={activeFilterCount > 0}
        onClearFilters={() => {
          onStatusFilterChange("all");
          onTagFilterChange("all");
        }}
        clearFiltersLabel={t("common.clearFilters")}
        filterButton={
          <AccountingFiltersMenuButton
            statusFilter={statusFilter}
            tagFilter={tagFilter}
            activeFilterCount={activeFilterCount}
            onChangeStatus={onStatusFilterChange}
            onChangeTag={onTagFilterChange}
            onClearFilters={() => {
              onStatusFilterChange("all");
              onTagFilterChange("all");
            }}
          />
        }
        primaryAction={undefined}
        trashToggle={
          canDelete && onToggleDeleted
            ? {
                canViewDeleted: canDelete,
                viewingDeleted: showDeleted,
                onToggle: onToggleDeleted,
                activeLabel: t("accounting.trash.showActive"),
                deletedLabel: t("accounting.trash.showDeleted"),
              }
            : undefined
        }
        viewModeToggle={{
          viewMode,
          onViewModeChange,
        }}
        columnCustomizer={
          columnCustomizer
            ? {
                registry: columnCustomizer.columnRegistry,
                onUpdate: columnCustomizer.updateUserColumnLayout,
                onReset: columnCustomizer.onResetLayout,
                labels: columnCustomizer.labels,
              }
            : undefined
        }
        filterChips={
          <FilterChips
            chips={chips}
            onClearAll={() => {
              onStatusFilterChange("all");
              onTagFilterChange("all");
            }}
          />
        }
      >
        <Button
          type="button"
          variant={showFilters ? "secondary" : "outline"}
          aria-pressed={showFilters}
          aria-expanded={showFilters}
          aria-controls="accounting-journal-date-filters"
          onClick={() => onShowFiltersChange(!showFilters)}
          className="flex min-h-11 items-center gap-1.5 rounded-xl text-sm font-semibold"
        >
          {t("accounting.journal.dashboard.dateRange")}
        </Button>
        {!showDeleted ? (
          <Button
            type="button"
            variant="outline"
            onClick={onExportCsv}
            className="flex min-h-11 items-center gap-1.5 rounded-xl text-sm font-semibold text-muted-foreground"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />{" "}
            {t("accounting.journal.exportCurrentPage")}
          </Button>
        ) : null}
      </WorkTaskToolbar>
    </>
  );
}

export {
  JournalEntriesAdvancedFilters,
  type JournalEntriesAdvancedFiltersProps,
} from "./JournalEntriesAdvancedFilters";
