import * as React from "react";
import { isYearWithinBounds, parseYearValue, resolveYearPickerBounds } from "@mms/shared";

export interface DatePickerYearModeDeps {
  mode?: "date" | "year" | "flexible";
  yearOnly?: boolean;
  value?: string | number | Date | null;
  min?: string | number | null;
  max?: string | number | null;
  minYear?: number | null;
  maxYear?: number | null;
  open: boolean;
  onChange?: (value: string) => void;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setInputValue: React.Dispatch<React.SetStateAction<string>>;
  lastParsedRef: React.RefObject<string | null>;
}

/** Year-mode slice of `useDatePickerState`: year bounds, decade paging and year selection. */
export function useDatePickerYearMode({
  mode,
  yearOnly,
  value,
  min,
  max,
  minYear,
  maxYear,
  open,
  onChange,
  setOpen,
  setInputValue,
  lastParsedRef,
}: DatePickerYearModeDeps) {
  const isYearMode = mode === "year" || Boolean(yearOnly);

  const selectedYear = React.useMemo(() => parseYearValue(value), [value]);

  const yearBounds = React.useMemo(
    () => resolveYearPickerBounds(min, max, minYear, maxYear),
    [min, max, minYear, maxYear],
  );
  const resolvedMinYear = yearBounds.minYear;
  const resolvedMaxYear = yearBounds.maxYear;

  const [yearPageStart, setYearPageStart] = React.useState<number>(
    () => Math.floor((selectedYear ?? new Date().getFullYear()) / 10) * 10,
  );

  // Mirror external `value` changes into the typed input while in year mode.
  React.useEffect(() => {
    if (!isYearMode) return;
    const formatted = selectedYear != null ? String(selectedYear) : "";
    if (formatted !== lastParsedRef.current) {
      setInputValue(formatted);
      lastParsedRef.current = formatted;
    }
  }, [selectedYear, isYearMode, lastParsedRef, setInputValue]);

  // Re-open: jump the decade grid to the selected (or current) year.
  React.useEffect(() => {
    if (!open || !isYearMode) return;
    setYearPageStart(Math.floor((selectedYear ?? new Date().getFullYear()) / 10) * 10);
  }, [open, selectedYear, isYearMode]);

  const handleSelectYear = (year: number) => {
    if (!isYearWithinBounds(year, resolvedMinYear, resolvedMaxYear)) return;
    const yearStr = String(year);
    lastParsedRef.current = yearStr;
    onChange?.(yearStr);
    setInputValue(yearStr);
    setOpen(false);
  };

  const goToPreviousYearPage = () => {
    setYearPageStart((prev) => prev - 12);
  };

  const goToNextYearPage = () => {
    setYearPageStart((prev) => prev + 12);
  };

  const isThisYearAllowed = React.useMemo(() => {
    return isYearWithinBounds(new Date().getFullYear(), resolvedMinYear, resolvedMaxYear);
  }, [resolvedMinYear, resolvedMaxYear]);

  const handleSelectThisYear = () => {
    const currentYear = new Date().getFullYear();
    if (isThisYearAllowed) {
      handleSelectYear(currentYear);
    }
  };

  return {
    isYearMode,
    selectedYear,
    resolvedMinYear,
    resolvedMaxYear,
    yearPageStart,
    setYearPageStart,
    goToPreviousYearPage,
    goToNextYearPage,
    handleSelectYear,
    handleSelectThisYear,
    isThisYearAllowed,
  };
}
