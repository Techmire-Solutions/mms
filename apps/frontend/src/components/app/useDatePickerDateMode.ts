import * as React from "react";
import {
  formatDateToIso,
  formatIsoDateToDisplay,
  isDateWithinIsoBounds,
  parseFlexibleIsoDate,
  type DateFormatId,
} from "@mms/shared";
import {
  resolveDatePickerMonthBounds,
  resolveDisabledDays,
  resolveInitialDisplayMonth,
} from "./datePickerBounds";

export interface DatePickerDateModeDeps {
  value?: string | number | Date | null;
  min?: string | number | null;
  max?: string | number | null;
  open: boolean;
  isYearMode: boolean;
  dateFormat: DateFormatId;
  onChange?: (value: string) => void;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setInputValue: React.Dispatch<React.SetStateAction<string>>;
  lastParsedRef: React.MutableRefObject<string | null>;
  setYearPageStart: (page: number) => void;
}

/** Standard date/calendar-mode slice of `useDatePickerState`. */
export function useDatePickerDateMode({
  value,
  min,
  max,
  open,
  isYearMode,
  dateFormat,
  onChange,
  setOpen,
  setInputValue,
  lastParsedRef,
  setYearPageStart,
}: DatePickerDateModeDeps) {
  const dateValue = React.useMemo(
    () =>
      typeof value === "string"
        ? parseFlexibleIsoDate(value)
        : value instanceof Date
          ? value
          : undefined,
    [value],
  );

  const [displayMonth, setDisplayMonth] = React.useState<Date>(() =>
    resolveInitialDisplayMonth(dateValue, min, max),
  );

  // Snap the calendar back to the relevant month whenever the picker re-opens or the
  // value/bounds change. Adjusted during render (React's documented prop-change
  // pattern) so the calendar never paints the previous entry's month.
  const [monthAnchor, setMonthAnchor] = React.useState(() => ({
    open,
    dateValue,
    min,
    max,
    isYearMode,
  }));
  if (
    monthAnchor.open !== open ||
    monthAnchor.dateValue !== dateValue ||
    monthAnchor.min !== min ||
    monthAnchor.max !== max ||
    monthAnchor.isYearMode !== isYearMode
  ) {
    setMonthAnchor({ open, dateValue, min, max, isYearMode });
    if (open && !isYearMode) {
      setDisplayMonth(resolveInitialDisplayMonth(dateValue, min, max));
    }
  }

  const minIsoStr = typeof min === "string" ? min : undefined;
  const maxIsoStr = typeof max === "string" ? max : undefined;

  const disabledDays = React.useMemo(
    () => resolveDisabledDays(minIsoStr, maxIsoStr, isYearMode),
    [minIsoStr, maxIsoStr, isYearMode],
  );

  const { startMonth, endMonth } = React.useMemo(
    () => resolveDatePickerMonthBounds(minIsoStr, maxIsoStr),
    [minIsoStr, maxIsoStr],
  );

  const commitIso = (iso: string, nextDisplayMonth?: Date, updateInput = true) => {
    lastParsedRef.current = iso;
    onChange?.(iso);
    if (updateInput) {
      setInputValue(formatIsoDateToDisplay(iso, dateFormat));
    }
    if (nextDisplayMonth) setDisplayMonth(nextDisplayMonth);
  };

  const clearValue = () => {
    lastParsedRef.current = "";
    onChange?.("");
    setInputValue("");
    setDisplayMonth(new Date());
    setYearPageStart(Math.floor(new Date().getFullYear() / 10) * 10);
  };

  const handleSelect = (date: Date | undefined) => {
    if (!date) {
      clearValue();
      setOpen(false);
      return;
    }
    commitIso(formatDateToIso(date), date);
    setOpen(false);
  };

  const isTodayAllowed = React.useMemo(
    () => isDateWithinIsoBounds(new Date(), minIsoStr, maxIsoStr),
    [minIsoStr, maxIsoStr],
  );

  const handleSelectToday = () => {
    const today = new Date();
    if (isTodayAllowed) {
      commitIso(formatDateToIso(today), today);
      setOpen(false);
    }
  };

  const handleClear = (event?: React.MouseEvent | React.SyntheticEvent) => {
    event?.stopPropagation();
    clearValue();
  };

  return {
    dateValue,
    displayMonth,
    setDisplayMonth,
    disabledDays,
    startMonth,
    endMonth,
    minIsoStr,
    maxIsoStr,
    isTodayAllowed,
    commitIso,
    clearValue,
    handleSelect,
    handleSelectToday,
    handleClear,
  };
}
