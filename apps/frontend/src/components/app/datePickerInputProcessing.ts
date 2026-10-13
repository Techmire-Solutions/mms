import {
  formatDateInputAsYouType,
  formatIsoDateToDisplay,
  isDateWithinIsoBounds,
  isYearWithinBounds,
  parseDisplayDateToIso,
  parseFlexibleIsoDate,
  type DateFormatId,
} from "@mms/shared";

export interface DatePickerInputChangeParams {
  rawValue: string;
  isYearMode: boolean;
  resolvedMinYear: number | null;
  resolvedMaxYear: number | null;
  dateFormat: DateFormatId;
  currentInputValue: string;
  minIsoStr?: string;
  maxIsoStr?: string;
  clearValue: () => void;
  setInputValue: (val: string) => void;
  lastParsedRef: React.MutableRefObject<string | null>;
  onChange?: (val: string) => void;
  setYearPageStart: (page: number) => void;
  commitIso: (iso: string, nextDisplayMonth?: Date, updateInput?: boolean) => void;
}

export function processDatePickerInputChange({
  rawValue,
  isYearMode,
  resolvedMinYear,
  resolvedMaxYear,
  dateFormat,
  currentInputValue,
  minIsoStr,
  maxIsoStr,
  clearValue,
  setInputValue,
  lastParsedRef,
  onChange,
  setYearPageStart,
  commitIso,
}: DatePickerInputChangeParams): void {
  if (rawValue === "") {
    clearValue();
    return;
  }

  if (isYearMode) {
    const digits = rawValue.replace(/\D/g, "").slice(0, 4);
    setInputValue(digits);

    if (digits.length === 4) {
      const num = Number(digits);
      if (isYearWithinBounds(num, resolvedMinYear, resolvedMaxYear)) {
        lastParsedRef.current = digits;
        onChange?.(digits);
        setYearPageStart(Math.floor(num / 10) * 10);
      }
    }
    return;
  }

  const formatted = formatDateInputAsYouType(rawValue, dateFormat, currentInputValue);
  setInputValue(formatted);

  const parsed = parseDisplayDateToIso(formatted, dateFormat);
  if (!parsed) return;
  const parsedDate = parseFlexibleIsoDate(parsed);
  if (!parsedDate || !isDateWithinIsoBounds(parsedDate, minIsoStr, maxIsoStr)) return;
  commitIso(parsed, parsedDate, false);
}

export interface DatePickerBlurParams {
  inputValue: string;
  isYearMode: boolean;
  resolvedMinYear: number | null;
  resolvedMaxYear: number | null;
  selectedYear?: number | null;
  dateFormat: DateFormatId;
  rawIsoString: string;
  minIsoStr?: string;
  maxIsoStr?: string;
  clearValue: () => void;
  setInputValue: (val: string) => void;
  lastParsedRef: React.MutableRefObject<string | null>;
  onChange?: (val: string) => void;
  commitIso: (iso: string, nextDisplayMonth?: Date) => void;
}

export function processDatePickerBlur({
  inputValue,
  isYearMode,
  resolvedMinYear,
  resolvedMaxYear,
  selectedYear,
  dateFormat,
  rawIsoString,
  minIsoStr,
  maxIsoStr,
  clearValue,
  setInputValue,
  lastParsedRef,
  onChange,
  commitIso,
}: DatePickerBlurParams): void {
  if (isYearMode) {
    if (!inputValue) {
      clearValue();
    } else if (inputValue.length === 4) {
      const num = Number(inputValue);
      if (isYearWithinBounds(num, resolvedMinYear, resolvedMaxYear)) {
        const yearStr = String(num);
        lastParsedRef.current = yearStr;
        onChange?.(yearStr);
        setInputValue(yearStr);
      } else {
        setInputValue(selectedYear ? String(selectedYear) : "");
      }
    } else {
      setInputValue(selectedYear ? String(selectedYear) : "");
    }
    return;
  }

  if (!inputValue) {
    clearValue();
    return;
  }

  const parsed = parseDisplayDateToIso(inputValue, dateFormat);
  const parsedDate = parsed ? parseFlexibleIsoDate(parsed) : undefined;
  if (parsed && parsedDate && isDateWithinIsoBounds(parsedDate, minIsoStr, maxIsoStr)) {
    commitIso(parsed, parsedDate);
    return;
  }
  setInputValue(formatIsoDateToDisplay(rawIsoString || "", dateFormat));
}
