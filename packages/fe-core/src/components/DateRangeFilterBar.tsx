import type { ReactNode } from "react";
import { DatePicker } from "./DatePicker";
import { FORM_LABEL } from "@mms/ui";
import { cn } from "@mms/ui";

export interface DateRangeFilterBarProps {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (date: string) => void;
  onDateToChange: (date: string) => void;
  idPrefix: string;
  fromLabel?: ReactNode;
  toLabel?: ReactNode;
  fromPlaceholder?: string;
  toPlaceholder?: string;
  /** Container class (layout only — do not re-border DatePicker chrome). */
  className?: string;
  /** Sizing-only classes for each DatePicker. */
  pickerClassName?: string;
  /** Classes for both labels, e.g. a shared min width so stacked From/To pickers line up. */
  labelClassName?: string;
  children?: ReactNode;
  showFrom?: boolean;
  showTo?: boolean;
}

/**
 * Shared from/to DatePicker pair for Work/Reports filters.
 * Always wires stable `id`/`name`; sizing-only classes — no double border chrome.
 */
export function DateRangeFilterBar({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  idPrefix,
  fromLabel,
  toLabel,
  fromPlaceholder,
  toPlaceholder,
  className,
  pickerClassName = "w-full min-w-0 sm:w-40",
  labelClassName,
  children,
  showFrom = true,
  showTo = true,
}: DateRangeFilterBarProps): React.JSX.Element {
  const fromId = `${idPrefix}-from`;
  const toId = `${idPrefix}-to`;

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {showFrom ? (
        <div className="flex min-w-0 flex-col gap-1 text-sm sm:flex-row sm:items-center sm:gap-2">
          {fromLabel ? (
            <label
              htmlFor={fromId}
              className={cn(FORM_LABEL, "mb-0 cursor-pointer", labelClassName)}
            >
              {fromLabel}
            </label>
          ) : null}
          <DatePicker
            id={fromId}
            name={fromId}
            value={dateFrom}
            onChange={onDateFromChange}
            placeholder={fromPlaceholder}
            className={pickerClassName}
            max={dateTo || undefined}
          />
        </div>
      ) : null}
      {showTo ? (
        <div className="flex min-w-0 flex-col gap-1 text-sm sm:flex-row sm:items-center sm:gap-2">
          {toLabel ? (
            <label htmlFor={toId} className={cn(FORM_LABEL, "mb-0 cursor-pointer", labelClassName)}>
              {toLabel}
            </label>
          ) : null}
          <DatePicker
            id={toId}
            name={toId}
            value={dateTo}
            onChange={onDateToChange}
            placeholder={toPlaceholder}
            className={pickerClassName}
            min={dateFrom || undefined}
          />
        </div>
      ) : null}
      {children}
    </div>
  );
}
