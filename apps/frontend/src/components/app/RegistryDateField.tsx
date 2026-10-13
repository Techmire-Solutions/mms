import type React from "react";
import { DatePicker } from "@/components/ui/DatePicker";

export interface RegistryDateFieldProps {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  min?: string | number;
  max?: string | number;
  mode?: "date" | "year" | "flexible";
  yearOnly?: boolean;
  minYear?: number | null;
  maxYear?: number | null;
  placeholder?: string;
  error?: boolean;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

/**
 * @deprecated Prefer using `DatePicker` from `@/components/ui/DatePicker` directly.
 * Retained as a backward-compatible adapter.
 */
export function RegistryDateField({
  id,
  name,
  value,
  onChange,
  onBlur,
  required,
  disabled,
  className,
  min,
  max,
  mode,
  yearOnly,
  minYear,
  maxYear,
  placeholder,
  error,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: RegistryDateFieldProps): React.JSX.Element {
  return (
    <DatePicker
      id={id}
      name={name}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      required={required}
      disabled={disabled}
      className={className}
      min={min}
      max={max}
      mode={mode}
      yearOnly={yearOnly}
      minYear={minYear}
      maxYear={maxYear}
      placeholder={placeholder}
      aria-label={ariaLabel}
      aria-invalid={ariaInvalid ?? error}
      aria-describedby={ariaDescribedBy}
    />
  );
}
