import * as React from "react";
import { normalizeTimeHHmm } from "@mms/shared";
import { Input } from "@/components/ui/input";

export interface TimePickerProps {
  value?: string;
  onChange?: (value: string) => void;
  id?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  min?: string;
  max?: string;
  step?: number | string;
  className?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

/** Native `type="time"` input with form chrome and `HH:mm` normalization. */
export function TimePicker({
  value = "",
  onChange,
  id,
  name,
  required,
  disabled,
  min,
  max,
  step,
  className,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: TimePickerProps): React.JSX.Element {
  const fallbackId = React.useId();
  const resolvedId = id || fallbackId;
  const resolvedName = name || fallbackId;
  const displayValue = value ? normalizeTimeHHmm(value) : "";

  return (
    <Input
      type="time"
      id={resolvedId}
      name={resolvedName}
      value={displayValue}
      onChange={(event) => onChange?.(normalizeTimeHHmm(event.target.value))}
      required={required}
      disabled={disabled}
      min={min}
      max={max}
      step={step}
      className={className}
      aria-label={ariaLabel}
      aria-invalid={ariaInvalid}
      aria-describedby={ariaDescribedBy}
    />
  );
}
