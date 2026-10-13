import * as React from "react";
import type { Matcher } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface DatePickerCalendarContentProps {
  dateValue?: Date;
  displayMonth: Date;
  setDisplayMonth: (date: Date) => void;
  disabledDays?: Matcher[];
  startMonth?: Date;
  endMonth?: Date;
  handleSelect: (date: Date | undefined) => void;
  handleClear: () => void;
  handleSelectToday: () => void;
  isTodayAllowed: boolean;
  hasValue: boolean;
  disabled?: boolean;
  t: TranslationFunction;
}

export function DatePickerCalendarContent({
  dateValue,
  displayMonth,
  setDisplayMonth,
  disabledDays,
  startMonth,
  endMonth,
  handleSelect,
  handleClear,
  handleSelectToday,
  isTodayAllowed,
  hasValue,
  disabled,
  t,
}: DatePickerCalendarContentProps): React.JSX.Element {
  return (
    <>
      <Calendar
        mode="single"
        selected={dateValue}
        onSelect={handleSelect}
        month={displayMonth}
        onMonthChange={setDisplayMonth}
        disabled={disabledDays}
        captionLayout="dropdown"
        startMonth={startMonth}
        endMonth={endMonth}
        autoFocus
      />
      <div className="flex items-center justify-between border-t border-border/60 px-3.5 py-2.5 bg-muted/20">
        <button
          type="button"
          onClick={handleClear}
          disabled={!hasValue || disabled}
          className="min-h-8.5 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-destructive disabled:opacity-30 disabled:hover:text-muted-foreground transition-colors cursor-pointer disabled:cursor-not-allowed rounded-lg hover:bg-destructive/10"
        >
          {t("datePicker.clear")}
        </button>
        <button
          type="button"
          onClick={handleSelectToday}
          disabled={!isTodayAllowed || disabled}
          className="min-h-8.5 px-3 py-1.5 text-xs font-semibold text-primary hover:text-primary/80 disabled:opacity-30 disabled:hover:text-primary transition-colors cursor-pointer disabled:cursor-not-allowed rounded-lg hover:bg-primary/10"
        >
          {t("datePicker.today")}
        </button>
      </div>
    </>
  );
}
