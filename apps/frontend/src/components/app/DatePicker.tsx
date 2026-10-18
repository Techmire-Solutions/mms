import * as React from "react";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { YearPickerGrid } from "@/components/app/YearPickerGrid";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import { useDatePickerState } from "@/components/app/useDatePickerState";
import { DatePickerCalendarContent } from "@/components/app/DatePickerCalendarContent";
import { keepOpenForChrome, resolveDatePickerHiddenValue } from "@/components/app/datePickerBounds";
import type { DatePickerProps } from "@/components/app/datePickerTypes";
import { isImeSafeEnter } from "@shared/ui";

export type { DatePickerProps };

export function DatePicker({
  ref,
  value,
  onChange,
  onBlur,
  placeholder,
  className,
  disabled,
  min,
  max,
  id,
  name,
  required,
  autoComplete,
  mode = "date",
  yearOnly,
  minYear,
  maxYear,
  dateFormat,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: DatePickerProps) {
  const { t } = useTranslation();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const state = useDatePickerState({
    value,
    onChange,
    onBlur,
    min,
    max,
    mode,
    yearOnly,
    minYear,
    maxYear,
    dateFormat,
  });

  const resolvedId = id || state.fallbackId;
  const resolvedName = name || state.fallbackId;
  const dialogId = `${resolvedId}-popover`;
  const resolvedPlaceholder = placeholder || (state.isYearMode ? "YYYY" : state.dateFormat);
  const hiddenValue = resolveDatePickerHiddenValue(value, state.isYearMode);

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (isImeSafeEnter(event)) {
      event.preventDefault();
      state.handleBlur();
      state.setOpen(false);
    } else if (event.key === "Escape") {
      state.setOpen(false);
    } else if (event.key === "ArrowDown" && (event.altKey || !state.open)) {
      event.preventDefault();
      state.setOpen(true);
    }
  };

  return (
    <div
      ref={rootRef}
      className={cn(
        "group relative flex min-h-11 w-full items-center rounded-lg border bg-background px-3 text-sm text-foreground transition-all",
        ariaInvalid
          ? "border-destructive focus-within:border-destructive focus-within:ring-2 focus-within:ring-destructive/20"
          : "border-border hover:border-border/80 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/20",
        disabled && "opacity-60 bg-muted/20 cursor-not-allowed",
        className,
      )}
    >
      <Popover modal open={state.open} onOpenChange={state.setOpen}>
        <PopoverTrigger
          type="button"
          disabled={disabled}
          className="relative me-1.5 h-8 w-8 flex items-center justify-center hover:bg-muted/80 rounded-md text-muted-foreground group-focus-within:text-primary hover:text-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 after:absolute after:start-1/2 after:top-1/2 after:h-11 after:w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']"
          aria-label={state.isYearMode ? t("datePicker.openYearAria") : t("datePicker.openAria")}
        >
          <CalendarIcon className="h-4 w-4 transition-colors opacity-80" />
        </PopoverTrigger>
        <PopoverContent
          id={dialogId}
          className="w-auto p-0 surface-overlay rounded-2xl overflow-hidden"
          align="start"
          onInteractOutside={(e) => keepOpenForChrome(e, rootRef.current)}
          onFocusOutside={(e) => keepOpenForChrome(e, rootRef.current)}
        >
          {state.isYearMode ? (
            <YearPickerGrid
              selectedYear={state.selectedYear}
              yearPageStart={state.yearPageStart}
              minYear={state.resolvedMinYear}
              maxYear={state.resolvedMaxYear}
              onSelectYear={state.handleSelectYear}
              onPreviousPage={state.goToPreviousYearPage}
              onNextPage={state.goToNextYearPage}
              onClear={state.handleClear}
              onSelectThisYear={state.handleSelectThisYear}
              isThisYearAllowed={state.isThisYearAllowed}
              hasValue={Boolean(value)}
              disabled={disabled}
            />
          ) : (
            <DatePickerCalendarContent
              dateValue={state.dateValue}
              displayMonth={state.displayMonth}
              setDisplayMonth={state.setDisplayMonth}
              disabledDays={state.disabledDays}
              startMonth={state.startMonth}
              endMonth={state.endMonth}
              handleSelect={state.handleSelect}
              handleClear={state.handleClear}
              handleSelectToday={state.handleSelectToday}
              isTodayAllowed={state.isTodayAllowed}
              hasValue={Boolean(value)}
              disabled={disabled}
              t={t}
            />
          )}
        </PopoverContent>
      </Popover>

      <input
        ref={ref}
        type="text"
        dir="ltr"
        inputMode="numeric"
        maxLength={state.isYearMode ? 4 : undefined}
        id={resolvedId}
        name={resolvedName}
        value={state.inputValue}
        onChange={state.handleInputChange}
        onBlur={state.handleBlur}
        autoComplete={autoComplete}
        onKeyDown={handleInputKeyDown}
        placeholder={resolvedPlaceholder}
        disabled={disabled}
        className="min-h-11 min-w-0 flex-1 border-0 bg-transparent p-0 text-start text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50"
        role="combobox"
        aria-haspopup="dialog"
        aria-expanded={state.open}
        aria-controls={dialogId}
        aria-required={required}
        aria-label={
          ariaLabel ||
          (state.isYearMode
            ? t("datePicker.enterYearAria")
            : t("datePicker.enterFormatAria", { format: state.dateFormat }))
        }
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
      />

      {value && !disabled && (
        <button
          type="button"
          onClick={state.handleClear}
          className="relative h-7 w-7 flex items-center justify-center hover:bg-destructive/10 rounded-md text-muted-foreground hover:text-destructive transition-colors cursor-pointer shrink-0 ms-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 after:absolute after:start-1/2 after:top-1/2 after:h-11 after:w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']"
          aria-label={t("datePicker.clearAria")}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {required && !value && (
        <input
          id={`${resolvedId}-required-helper`}
          name={`${resolvedName}-required-helper`}
          type="text"
          className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
          required
          value=""
          onChange={() => {}}
          tabIndex={-1}
          aria-hidden="true"
        />
      )}
      <input type="hidden" name={`${resolvedName}_hidden`} value={hiddenValue || ""} />
    </div>
  );
}
DatePicker.displayName = "DatePicker";
