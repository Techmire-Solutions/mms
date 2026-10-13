import * as React from "react";
import {
  DEFAULT_GLOBAL_SETTINGS,
  formatDateToIso,
  formatIsoDateToDisplay,
  normalizeDateFormat,
  type DateFormatId,
} from "@mms/shared";
import { useDateFormat } from "@/lib/contexts/DateFormatContext";
import { useDatePickerYearMode } from "./datePickerYearMode";
import { useDatePickerDateMode } from "./useDatePickerDateMode";
import { processDatePickerBlur, processDatePickerInputChange } from "./datePickerInputProcessing";

export interface UseDatePickerStateOptions {
  value?: string | number | Date | null;
  onChange?: (value: string) => void;
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
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
  const fallbackId = React.useId();

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
      lastParsedRef.current = rawIsoString || null;
      lastFormatRef.current = dateFormat;
    }
  }, [rawIsoString, dateFormat, yearMode.isYearMode]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
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
    processDatePickerBlur({
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
    if (event) onBlur?.(event);
  };

  return {
    ...yearMode,
    ...dateMode,
    open,
    setOpen,
    inputValue,
    fallbackId,
    dateFormat,
    handleInputChange,
    handleBlur,
  };
}
