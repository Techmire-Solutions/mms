import React from "react";
import { Calendar } from "lucide-react";
import { DateRangeFilterBar } from "@mms/fe-core/components/DateRangeFilterBar";
import { Button } from "@mms/ui";
import { calculateReportDateRange } from "../lib/reportDateUtils";
import type { TranslationFunction } from "@mms/fe-core/i18n";
import type { ReportFilterFieldKey } from "./reportFilterTypes";

export interface ReportFilterDateRangeSectionProps {
  dateFrom: string;
  dateTo: string;
  showDateFrom: boolean;
  showDateTo: boolean;
  onFieldChange: (key: ReportFilterFieldKey, value: string) => void;
  t: TranslationFunction;
}

export function ReportFilterDateRangeSection({
  dateFrom,
  dateTo,
  showDateFrom,
  showDateTo,
  onFieldChange,
  t,
}: ReportFilterDateRangeSectionProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1 min-w-filter-md flex-1">
      {/* Wraps as a whole: the presets move below the label instead of the label
          breaking over two lines and a lone preset dropping onto its own row. */}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className="whitespace-nowrap text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {t("reports.comparison.dateRanges")}
        </span>
        <div className="flex flex-wrap items-center gap-1">
          <Button
            type="button"
            variant={!dateFrom && !dateTo ? "secondary" : "ghost"}
            size="sm"
            className="min-h-11 px-2.5 text-3xs font-medium"
            onClick={() => {
              const range = calculateReportDateRange("none");
              onFieldChange("dateFrom", range.from);
              onFieldChange("dateTo", range.to);
            }}
          >
            {t("common.none")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11 px-2.5 text-3xs font-medium"
            onClick={() => {
              const range = calculateReportDateRange("today");
              onFieldChange("dateFrom", range.from);
              onFieldChange("dateTo", range.to);
            }}
          >
            {t("datePicker.today")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11 px-2.5 text-3xs font-medium"
            onClick={() => {
              const range = calculateReportDateRange("7d");
              onFieldChange("dateFrom", range.from);
              onFieldChange("dateTo", range.to);
            }}
          >
            {t("messaging.datePreset7d")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11 px-2.5 text-3xs font-medium"
            onClick={() => {
              const range = calculateReportDateRange("30d");
              onFieldChange("dateFrom", range.from);
              onFieldChange("dateTo", range.to);
            }}
          >
            {t("messaging.datePreset30d")}
          </Button>
        </div>
      </div>
      <DateRangeFilterBar
        idPrefix="report-filters"
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={(value: any) => onFieldChange("dateFrom", value)}
        onDateToChange={(value: any) => onFieldChange("dateTo", value)}
        showFrom={showDateFrom}
        showTo={showDateTo}
        fromLabel={
          showDateFrom ? (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" aria-hidden="true" />
              {t("reports.filters.from")}
            </span>
          ) : undefined
        }
        toLabel={
          showDateTo ? (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" aria-hidden="true" />
              {t("reports.filters.to")}
            </span>
          ) : undefined
        }
        // One full-width row per picker with a shared label width, so the From and
        // To inputs start and end on the same lines.
        className="grid w-full grid-cols-1 gap-3"
        pickerClassName="w-full min-w-0"
        labelClassName="sm:min-w-14 sm:shrink-0"
      />
    </div>
  );
}
