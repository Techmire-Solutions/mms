import * as React from "react";
import type { Matcher } from "react-day-picker";
import { Calendar } from "@mms/ui";
import type { TranslationFunction } from "../i18n";

export interface DatePickerCalendarContentProps {
  dateValue?: Date;
  displayMonth: Date;
  setDisplayMonth: (date: Date) => void;
  disabledDays?: Matcher[];
  holidays?: readonly string[];
  startMonth?: Date;
  endMonth?: Date;
  handleSelect: (date: Date | undefined) => void;
  handleClear: () => void;
  handleSelectToday: () => void;
  handleSelectYesterday?: () => void;
  isTodayAllowed: boolean;
  isYesterdayAllowed?: boolean;
  hasValue: boolean;
  disabled?: boolean;
  t: TranslationFunction;
}

export function DatePickerCalendarContent({
  dateValue,
  displayMonth,
  setDisplayMonth,
  disabledDays,
  holidays,
  startMonth,
  endMonth,
  handleSelect,
  handleClear,
  handleSelectToday,
  handleSelectYesterday,
  isTodayAllowed,
  isYesterdayAllowed,
  hasValue,
  disabled,
  t,
}: DatePickerCalendarContentProps): React.JSX.Element {
  // Parsed as local midnight so the marked cell matches the grid's own local-time days.
  const holidayDays = React.useMemo(
    () =>
      (holidays ?? []).flatMap((iso) => {
        const [year, month, day] = iso.split("-").map(Number);
        if (!year || !month || !day) return [];
        return [new Date(year, month - 1, day)];
      }),
    [holidays],
  );

  const currentYear = displayMonth.getFullYear();
  const minAllowedYear = startMonth ? startMonth.getFullYear() : currentYear - 100;
  const maxAllowedYear = endMonth ? endMonth.getFullYear() : currentYear + 10;
  const canJumpBack = currentYear > minAllowedYear;
  const canJumpForward = currentYear < maxAllowedYear;

  const jumpYears = (offset: number) => {
    const targetYear = Math.max(minAllowedYear, Math.min(maxAllowedYear, currentYear + offset));
    const next = new Date(displayMonth);
    next.setFullYear(targetYear);
    setDisplayMonth(next);
  };

  return (
    <>
      <Calendar
        mode="single"
        selected={dateValue}
        onSelect={handleSelect}
        month={displayMonth}
        onMonthChange={setDisplayMonth}
        disabled={disabledDays}
        modifiers={holidayDays.length > 0 ? { holiday: holidayDays } : undefined}
        captionLayout="dropdown"
        startMonth={startMonth}
        endMonth={endMonth}
      />
      <div className="flex items-center justify-between border-t border-border/40 px-3 py-1.5 bg-muted/10 text-xs">
        <span className="text-3xs font-semibold text-muted-foreground uppercase tracking-wider">
          {t("datePicker.jumpYear") || "Years"}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => jumpYears(-10)}
            disabled={!canJumpBack || disabled}
            aria-label="-10 years"
            className="px-1.5 py-0.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            -10y
          </button>
          <button
            type="button"
            onClick={() => jumpYears(-1)}
            disabled={!canJumpBack || disabled}
            aria-label="-1 year"
            className="px-1.5 py-0.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            -1y
          </button>
          <button
            type="button"
            onClick={() => jumpYears(1)}
            disabled={!canJumpForward || disabled}
            aria-label="+1 year"
            className="px-1.5 py-0.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            +1y
          </button>
          <button
            type="button"
            onClick={() => jumpYears(10)}
            disabled={!canJumpForward || disabled}
            aria-label="+10 years"
            className="px-1.5 py-0.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            +10y
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-border/60 px-3.5 py-2.5 bg-muted/20">
        <button
          type="button"
          onClick={handleClear}
          disabled={!hasValue || disabled}
          className="min-h-8.5 touch-target-coarse px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-destructive disabled:opacity-30 disabled:hover:text-muted-foreground transition-colors cursor-pointer disabled:cursor-not-allowed rounded-lg hover:bg-destructive/10"
        >
          {t("datePicker.clear")}
        </button>
        <div className="flex items-center gap-1.5">
          {handleSelectYesterday && (
            <button
              type="button"
              onClick={handleSelectYesterday}
              disabled={!isYesterdayAllowed || disabled}
              className="min-h-8.5 touch-target-coarse px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/80 disabled:opacity-30 disabled:hover:text-muted-foreground transition-colors cursor-pointer disabled:cursor-not-allowed rounded-lg"
            >
              {t("datePicker.yesterday") || "Yesterday"}
            </button>
          )}
          <button
            type="button"
            onClick={handleSelectToday}
            disabled={!isTodayAllowed || disabled}
            className="min-h-8.5 touch-target-coarse px-3 py-1.5 text-xs font-semibold text-primary hover:text-primary/80 disabled:opacity-30 disabled:hover:text-primary transition-colors cursor-pointer disabled:cursor-not-allowed rounded-lg hover:bg-primary/10"
          >
            {t("datePicker.today")}
          </button>
        </div>
      </div>
    </>
  );
}
