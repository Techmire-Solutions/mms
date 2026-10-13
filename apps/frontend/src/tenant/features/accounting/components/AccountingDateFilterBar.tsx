import React from "react";
import { Download } from "lucide-react";
import { DateRangeFilterBar } from "@/components/app/DateRangeFilterBar";
import { Button } from "@/components/ui/button";
import type { FiscalYear } from "@/lib/data/accountingData";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

interface AccountingDateFilterBarProps {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (date: string) => void;
  onDateToChange: (date: string) => void;
  activeFiscalYear?: FiscalYear;
  onExportCSV?: () => void;
  idPrefix: string;
  variant?: "bordered" | "simple";
}

/**
 * Accounting date filter bar — shared DateRangeFilterBar + FY / all-time / CSV slots.
 */
export function AccountingDateFilterBar({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  activeFiscalYear,
  onExportCSV,
  idPrefix,
  variant = "simple",
}: AccountingDateFilterBarProps) {
  const { t } = useTranslation();

  return (
    <nav aria-label={`${idPrefix} Date Filters`}>
      <DateRangeFilterBar
        idPrefix={idPrefix}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={onDateFromChange}
        onDateToChange={onDateToChange}
        fromLabel={t("accounting.ledger.from")}
        toLabel={t("accounting.ledger.to")}
        className={cn(variant === "bordered" && "rounded-xl border border-border bg-muted/20 p-4")}
      >
        {activeFiscalYear ? (
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={() => {
              onDateFromChange(activeFiscalYear.startDate);
              onDateToChange(activeFiscalYear.endDate);
            }}
            className="min-h-11 p-0 text-xs font-semibold text-primary transition-colors hover:text-primary/80"
          >
            {t("accounting.ledger.activeFy", { label: activeFiscalYear.label })}
          </Button>
        ) : null}

        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={() => {
            onDateFromChange("");
            onDateToChange("");
          }}
          className="min-h-11 p-0 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {t("accounting.ledger.allTime")}
        </Button>

        {onExportCSV ? (
          <Button
            type="button"
            variant="outline"
            onClick={onExportCSV}
            className="ms-auto flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />{" "}
            {t("accounting.ledger.exportCsv")}
          </Button>
        ) : null}
      </DateRangeFilterBar>
    </nav>
  );
}
