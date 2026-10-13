import React from "react";
import { BarChart2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateRangeFilterBar } from "@/components/ui/DateRangeFilterBar";
import { WORK_SURFACE } from "@/components/ui/formStyles";
import { SEMANTIC_TEXT } from "@/lib/semanticTone";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface MessagingReportHeaderBarProps {
  startDate: string;
  endDate: string;
  exporting: boolean;
  canWrite: boolean;
  onStartDateChange: (val: string) => void;
  onEndDateChange: (val: string) => void;
  onApplyPreset: (days?: number) => void;
  onExport: () => void;
  t: TranslationFunction;
}

export function MessagingReportHeaderBar({
  startDate,
  endDate,
  exporting,
  canWrite,
  onStartDateChange,
  onEndDateChange,
  onApplyPreset,
  onExport,
  t,
}: MessagingReportHeaderBarProps): React.JSX.Element {
  return (
    <div
      className={`${WORK_SURFACE} p-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between`}
    >
      <div className="flex items-center gap-2">
        <BarChart2 className={`h-5 w-5 ${SEMANTIC_TEXT.primary}`} />
        <div>
          <h3 className="text-sm font-bold text-foreground">{t("nav.messaging")}</h3>
          <p className="text-xs text-muted-foreground">{t("messaging.subtitle")}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant={!startDate && !endDate ? "secondary" : "ghost"}
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={() => onApplyPreset(undefined)}
          >
            {t("common.none")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={() => onApplyPreset(0)}
          >
            {t("datePicker.today")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={() => onApplyPreset(7)}
          >
            {t("messaging.datePreset7d")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={() => onApplyPreset(30)}
          >
            {t("messaging.datePreset30d")}
          </Button>
        </div>

        <DateRangeFilterBar
          idPrefix="messaging-reports"
          dateFrom={startDate}
          dateTo={endDate}
          onDateFromChange={onStartDateChange}
          onDateToChange={onEndDateChange}
          fromPlaceholder={t("messaging.dateFrom")}
          toPlaceholder={t("messaging.dateTo")}
          pickerClassName="w-full min-w-0 text-sm sm:w-36"
        />

        {canWrite && (
          <Button
            variant="outline"
            size="sm"
            disabled={exporting}
            aria-busy={exporting}
            onClick={onExport}
            className="font-semibold h-9"
          >
            <Download className="me-1.5 h-4 w-4" />
            {exporting ? t("common.loading") : t("messaging.exportLogs")}
          </Button>
        )}
      </div>
    </div>
  );
}
