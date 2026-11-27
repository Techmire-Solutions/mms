import * as React from "react";
import {
  DEFAULT_GLOBAL_SETTINGS,
  formatDateToIso,
  formatIsoDateToDisplay,
  normalizeDateFormat,
  type DateFormatId,
} from "@mms/contracts";
import { useDateFormat } from "./DateFormatContext";
import { useDatePickerYearMode } from "@mms/ui/app/datePickerYearMode";
import { useDatePickerDateMode } from "@mms/ui/app/useDatePickerDateMode";
import {
  processDatePickerBlur,
  processDatePickerInputChange,
  type DatePickerBlurResult,
} from "@mms/ui/app/datePickerInputProcessing";

export interface UseDatePickerStateOptions {
  value?: string | number | Date | null;
  onChange?: (value: string) => void;
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  onInvalidChange?: (invalid: boolean) => void;
  min?: string | number | null;
  max?: string | number | null;
  mode?: "date" | "year" | "flexible";
  yearOnly?: boolean;
  minYear?: number | null;
  maxYear?: number | null;
  dateFormat?: DateFormatId | string;
}

export function useDatePickerState({
  value,
  onChange,
  onBlur,
  onInvalidChange,
  min,
  max,
  mode = "date",
  yearOnly,
  minYear,
  maxYear,
  dateFormat: explicitDateFormat,
}: UseDatePickerStateOptions) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");
  const [invalidReason, setInvalidReason] = React.useState<Exclude<
    DatePickerBlurResult,
    "valid"
  > | null>(null);
  const fallbackId = React.useId();

  const updateInvalidReason = React.useCallback(
    (next: Exclude<DatePickerBlurResult, "valid"> | null) => {
      setInvalidReason((prev) => {
        if (prev !== next) onInvalidChange?.(next !== null);
        return next;
      });
    },
    [onInvalidChange],
  );

  const contextFormat = useDateFormat();
  const dateFormat = normalizeDateFormat(
    explicitDateFormat ?? contextFormat,
    DEFAULT_GLOBAL_SETTINGS.dateFormat as DateFormatId,
  );

  const lastParsedRef = React.useRef<string | null>(null);
  const lastFormatRef = React.useRef<string>(dateFormat);

  const yearMode = useDatePickerYearMode({
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
  });

  const dateMode = useDatePickerDateMode({
    value,
    min,
    max,
    open,
    isYearMode: yearMode.isYearMode,
    dateFormat,
    onChange,
    setOpen,
    setInputValue,
    lastParsedRef,
    setYearPageStart: yearMode.setYearPageStart,
  });

  const rawIsoString =
    typeof value === "string" ? value : value instanceof Date ? formatDateToIso(value) : "";

  React.useEffect(() => {
    if (yearMode.isYearMode) return;
    if (rawIsoString !== lastParsedRef.current || dateFormat !== lastFormatRef.current) {
      setInputValue(formatIsoDateToDisplay(rawIsoString || "", dateFormat));
      updateInvalidReason(null);
      lastParsedRef.current = rawIsoString || null;
      lastFormatRef.current = dateFormat;
    }
  }, [rawIsoString, dateFormat, yearMode.isYearMode, updateInvalidReason]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (invalidReason) updateInvalidReason(null);
    processDatePickerInputChange({
      rawValue: event.target.value,
      isYearMode: yearMode.isYearMode,
      resolvedMinYear: yearMode.resolvedMinYear,
      resolvedMaxYear: yearMode.resolvedMaxYear,
      dateFormat,
      currentInputValue: inputValue,
      minIsoStr: dateMode.minIsoStr,
      maxIsoStr: dateMode.maxIsoStr,
      clearValue: dateMode.clearValue,
      setInputValue,
      lastParsedRef,
      onChange,
      setYearPageStart: yearMode.setYearPageStart,
      commitIso: dateMode.commitIso,
    });
  };

  const handleBlur = (event?: React.FocusEvent<HTMLInputElement>) => {
    const result = processDatePickerBlur({
      inputValue,
      isYearMode: yearMode.isYearMode,
      resolvedMinYear: yearMode.resolvedMinYear,
      resolvedMaxYear: yearMode.resolvedMaxYear,
      selectedYear: yearMode.selectedYear,
      dateFormat,
      rawIsoString,
      minIsoStr: dateMode.minIsoStr,
      maxIsoStr: dateMode.maxIsoStr,
      clearValue: dateMode.clearValue,
      setInputValue,
      lastParsedRef,
      onChange,
      commitIso: dateMode.commitIso,
    });
    updateInvalidReason(result === "valid" ? null : result);
    if (event) onBlur?.(event);
  };

  const handleClearWithReset = () => {
    updateInvalidReason(null);
    dateMode.handleClear();
  };

  const handleSelectWithReset = (date: Date | undefined) => {
    updateInvalidReason(null);
    dateMode.handleSelect(date);
  };

  return {
    ...yearMode,
    ...dateMode,
    handleClear: handleClearWithReset,
    handleSelect: handleSelectWithReset,
    open,
    setOpen,
    inputValue,
    invalidReason,
    fallbackId,
    dateFormat,
    handleInputChange,
    handleBlur,
  };
}
