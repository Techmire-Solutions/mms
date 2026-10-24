import type * as React from "react";
import type { DateFormatId } from "@mms/shared";

export interface DatePickerProps {
  value?: string | number | Date | null;
  onChange?: (value: string) => void;
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  min?: string | number | null;
  max?: string | number | null;
  id?: string;
  name?: string;
  required?: boolean;
  autoComplete?: string;
  mode?: "date" | "year" | "flexible";
  yearOnly?: boolean;
  minYear?: number | null;
  maxYear?: number | null;
  dateFormat?: DateFormatId | string;
  /** Non-instructional days (`YYYY-MM-DD`) to mark in the calendar popover. */
  holidays?: readonly string[];
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  ref?: React.Ref<HTMLInputElement>;
}
