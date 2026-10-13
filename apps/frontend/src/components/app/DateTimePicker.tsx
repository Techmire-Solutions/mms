import * as React from "react";
import { combineIsoDateAndTime, splitIsoDateTime } from "@mms/shared";
import { DatePicker } from "@/components/ui/DatePicker";
import { TimePicker } from "@/components/ui/TimePicker";
import { useTranslation } from "@/hooks/useTranslation";
import { FORM_INPUT_ERROR } from "@/components/ui/formStyles";
import { cn } from "@/lib/utils";

export interface DateTimePickerProps {
  value?: string | null;
  onChange?: (value: string | null) => void;
  id?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  error?: boolean;
  className?: string;
  dateAriaLabel?: string;
  timeAriaLabel?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

/** Composes DatePicker + TimePicker; stores ISO-8601 or `null`. */
export function DateTimePicker({
  value,
  onChange,
  id,
  name,
  required,
  disabled,
  error,
  className,
  dateAriaLabel,
  timeAriaLabel,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: DateTimePickerProps): React.JSX.Element {
  const { t } = useTranslation();
  const fallbackId = React.useId();
  const resolvedId = id || fallbackId;
  const resolvedName = name || fallbackId;
  const parts = value ? splitIsoDateTime(value) : null;
  const dateValue = parts?.date ?? "";
  const timeValue = parts?.time ?? "";
  const invalid = ariaInvalid ?? Boolean(error);
  const dateErrorClass = error
    ? "border-destructive focus-within:border-destructive focus-within:ring-destructive"
    : undefined;
  const timeErrorClass = error ? FORM_INPUT_ERROR : undefined;

  const emit = (nextDate: string, nextTime: string): void => {
    if (!nextDate.trim()) {
      onChange?.(null);
      return;
    }
    onChange?.(combineIsoDateAndTime(nextDate, nextTime));
  };

  return (
    <div className={cn("@container grid grid-cols-1 gap-2 @sm:grid-cols-2", className)}>
      <DatePicker
        id={resolvedId}
        name={resolvedName}
        value={dateValue}
        onChange={(nextDate) => emit(nextDate, timeValue)}
        required={required}
        disabled={disabled}
        className={dateErrorClass}
        aria-label={dateAriaLabel || t("dateTimePicker.dateAria")}
        aria-invalid={invalid}
        aria-describedby={ariaDescribedBy}
      />
      <TimePicker
        id={`${resolvedId}-time`}
        name={`${resolvedName}-time`}
        value={timeValue}
        onChange={(nextTime) => emit(dateValue, nextTime)}
        required={required && Boolean(dateValue)}
        disabled={disabled || !dateValue}
        className={timeErrorClass}
        aria-label={timeAriaLabel || t("dateTimePicker.timeAria")}
        aria-invalid={invalid}
        aria-describedby={ariaDescribedBy}
      />
    </div>
  );
}
