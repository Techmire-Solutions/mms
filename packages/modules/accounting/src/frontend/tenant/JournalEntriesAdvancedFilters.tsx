import React from "react";
import { Button } from "@mms/ui";
import { DateRangeFilterBar } from "@mms/fe-core/components/DateRangeFilterBar";
import { WORK_SURFACE } from "@mms/ui";
import { useTranslation } from "@mms/fe-core/i18n";
import { cn } from "@mms/ui";

export interface JournalEntriesAdvancedFiltersProps {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onClear: () => void;
}

export function JournalEntriesAdvancedFilters({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onClear,
}: JournalEntriesAdvancedFiltersProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div
      id="accounting-journal-date-filters"
      className={cn(WORK_SURFACE, "flex flex-wrap items-end gap-3 p-3")}
    >
      <DateRangeFilterBar
        idPrefix="filter"
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={onDateFromChange}
        onDateToChange={onDateToChange}
        fromLabel={t("accounting.journal.dashboard.fromDate")}
        toLabel={t("accounting.journal.dashboard.toDate")}
        pickerClassName="w-full min-w-0 sm:w-40"
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onClear}
        className="min-h-11 px-3 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        {t("accounting.journal.dashboard.clear")}
      </Button>
    </div>
  );
}
