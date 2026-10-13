import React from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { FormSelect } from "@/components/app/FormSelect";
import { Input } from "@/components/ui/input";
import type { ReportFilterFields, ReportFilterFieldKey } from "./reportFilterTypes";
import {
  normalizeReportFilterCategory,
  getReportFilterStatusOptions,
  getReportFilterSearchMeta,
} from "./reportFilterStatusOptions";
import { ReportFilterDateRangeSection } from "./ReportFilterDateRangeSection";

interface ReportFilterFieldsPanelProps {
  category?: string;
  allowed: ReportFilterFieldKey[];
  filters: ReportFilterFields;
  onFieldChange: (key: ReportFilterFieldKey, value: string) => void;
  sessions: Array<{ id: string; name: string }>;
  classes: Array<{ id: string; name: string }>;
}

export function ReportFilterFieldsPanel({
  category,
  allowed,
  filters,
  onFieldChange,
  sessions,
  classes,
}: ReportFilterFieldsPanelProps): React.JSX.Element {
  const { t } = useTranslation();
  const showDateFrom = allowed.includes("dateFrom");
  const showDateTo = allowed.includes("dateTo");

  const normalizedCategory = normalizeReportFilterCategory(category);
  const statusOptions = React.useMemo(
    () => getReportFilterStatusOptions(normalizedCategory, t),
    [normalizedCategory, t],
  );
  const { label: searchLabel, placeholder: searchPlaceholder } = React.useMemo(
    () => getReportFilterSearchMeta(normalizedCategory, t),
    [normalizedCategory, t],
  );

  return (
    <div className="px-4 pb-4 flex flex-wrap gap-4 border-t border-border/50 pt-4">
      {allowed.includes("session") && (
        <div className="flex flex-col gap-1 text-start min-w-filter-lg flex-1">
          <label
            htmlFor="report-filter-session"
            className="text-xs font-semibold text-muted-foreground uppercase tracking-wide"
          >
            {t("reports.filters.session")}
          </label>
          <FormSelect
            id="report-filter-session"
            value={filters.session}
            onChange={(val) => onFieldChange("session", val)}
            options={sessions.map((session) => ({ value: session.id, label: session.name }))}
            className="w-full"
          />
        </div>
      )}

      {allowed.includes("class") && (
        <div className="flex flex-col gap-1 text-start min-w-filter-lg flex-1">
          <label
            htmlFor="report-filter-class"
            className="text-xs font-semibold text-muted-foreground uppercase tracking-wide"
          >
            {t("reports.filters.class")}
          </label>
          <FormSelect
            id="report-filter-class"
            value={filters.class}
            onChange={(val) => onFieldChange("class", val)}
            options={classes.map((sessionClass) => ({
              value: sessionClass.id,
              label: sessionClass.name,
            }))}
            className="w-full"
          />
        </div>
      )}

      {allowed.includes("status") && (
        <div className="flex flex-col gap-1 text-start min-w-filter-sm flex-1">
          <label
            htmlFor="report-filter-status"
            className="text-xs font-semibold text-muted-foreground uppercase tracking-wide"
          >
            {t("reports.filters.status")}
          </label>
          <FormSelect
            id="report-filter-status"
            value={filters.status}
            onChange={(val) => onFieldChange("status", val)}
            options={statusOptions}
            className="w-full"
          />
        </div>
      )}

      {(showDateFrom || showDateTo) && (
        <ReportFilterDateRangeSection
          dateFrom={filters.dateFrom}
          dateTo={filters.dateTo}
          showDateFrom={showDateFrom}
          showDateTo={showDateTo}
          onFieldChange={onFieldChange}
          t={t}
        />
      )}

      {allowed.includes("student") && (
        <div className="flex flex-col gap-1 text-start min-w-filter-xl flex-1">
          <label
            htmlFor="report-filter-search"
            className="text-xs font-semibold text-muted-foreground uppercase tracking-wide"
          >
            {searchLabel}
          </label>
          <Input
            id="report-filter-search"
            type="text"
            value={filters.student}
            onChange={(event) => onFieldChange("student", event.target.value)}
            placeholder={searchPlaceholder}
            className="text-sm border-border/50 bg-background/50 backdrop-blur-sm focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
          />
        </div>
      )}
    </div>
  );
}
