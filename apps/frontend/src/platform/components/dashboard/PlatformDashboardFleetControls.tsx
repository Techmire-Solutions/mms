import React from "react";
import { Search } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { Switch, Label, LeadingIconInput, CompactSegmentedControl } from "@shared/ui";
import { DateRangeFilterBar } from "@/components/app/DateRangeFilterBar";
import { WORK_SURFACE } from "@shared/ui";
import { cn } from "@/lib/utils";

export type FleetStatusFilter = "all" | "active" | "inactive";

export interface PlatformDashboardFleetControlsProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: FleetStatusFilter;
  onStatusChange: (value: FleetStatusFilter) => void;
  autoRefresh: boolean;
  onAutoRefreshChange: (value: boolean) => void;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
}

/** Zone C — search, segmented status, auto-refresh toggle, date range. */
export function PlatformDashboardFleetControls({
  search,
  onSearchChange,
  status,
  onStatusChange,
  autoRefresh,
  onAutoRefreshChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
}: PlatformDashboardFleetControlsProps): React.JSX.Element {
  const { t } = useTranslation();
  const refreshId = "dashboard-fleet-auto-refresh";

  return (
    <div className={cn(WORK_SURFACE, "space-y-3 p-4")} data-testid="dashboard-fleet-controls">
      <div className="flex flex-wrap items-center gap-3">
        <LeadingIconInput
          icon={Search}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t("platform.fleetSearchPlaceholder")}
          aria-label={t("platform.fleetSearchPlaceholder")}
          className="min-w-[12rem] flex-1"
        />
        <CompactSegmentedControl
          value={status}
          onChange={onStatusChange}
          options={[
            { value: "all", label: t("platform.filterAll") },
            { value: "active", label: t("platform.workspaceActive") },
            { value: "inactive", label: t("platform.workspaceInactive") },
          ]}
        />
        <div className="flex items-center gap-2.5 min-h-11">
          <Switch
            id={refreshId}
            checked={autoRefresh}
            onCheckedChange={onAutoRefreshChange}
            aria-label={t("platform.autoRefresh")}
          />
          <Label
            htmlFor={refreshId}
            className="text-xs font-bold text-muted-foreground cursor-pointer"
          >
            {t("platform.autoRefresh")}
          </Label>
        </div>
      </div>
      <DateRangeFilterBar
        idPrefix="dashboard-fleet"
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={onDateFromChange}
        onDateToChange={onDateToChange}
        fromLabel={t("platform.dateFrom")}
        toLabel={t("platform.dateTo")}
      />
    </div>
  );
}
