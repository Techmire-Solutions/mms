import * as React from "react";
import { Checkbox } from "./Checkbox";
import { FieldErrorMessage } from "./FormField";
import { cn } from "../utils";

export interface CheckboxFieldProps {
  /** Explicit id; generated when omitted so the label always has a target. */
  id?: string;
  name?: string;
  checked: boolean | "indeterminate";
  onCheckedChange: (checked: boolean) => void;
  label: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  /** Message shown below the row; also marks the checkbox invalid for AT. */
  error?: string;
  className?: string;
  labelClassName?: string;
  checkboxClassName?: string;
}

/**
 * Single-row labelled checkbox — the SSOT for “checkbox + label (+ description)”
 * outside card-style forms (`FormCheckboxCard`).
 *
 * Guarantees, so call sites stop re-implementing them:
 * - the label is associated with the control and the whole label is clickable;
 * - a 44 px minimum row height (touch floor);
 * - optional description wired via `aria-describedby`;
 * - errors mark the checkbox `aria-invalid` and render the shared message.
 */
export function CheckboxField({
  id,
  name,
  checked,
  onCheckedChange,
  label,
  description,
  disabled = false,
  error,
  className,
  labelClassName,
  checkboxClassName,
}: CheckboxFieldProps): React.JSX.Element {
  const generatedId = React.useId();
  const resolvedId = id ?? generatedId;
  const descriptionId = description ? `${resolvedId}-description` : undefined;

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex min-h-11 min-w-11 items-start gap-2.5 select-none">
        <Checkbox
          id={resolvedId}
          name={name}
          checked={checked}
          disabled={disabled}
          error={Boolean(error)}
          aria-describedby={descriptionId}
          onCheckedChange={onCheckedChange}
          className={cn("mt-3.5", checkboxClassName)}
        />
        <div className={cn("min-w-0 flex-1 py-3", disabled && "opacity-60")}>
          <label
            htmlFor={resolvedId}
            className={cn(
              "block cursor-pointer text-sm font-medium text-foreground",
              disabled && "cursor-not-allowed",
              labelClassName,
            )}
          >
            {label}
          </label>
          {description ? (
            <span
              id={descriptionId}
              className="mt-0.5 block text-xs font-normal text-muted-foreground"
            >
              {description}
            </span>
          ) : null}
        </div>
      </div>
      {error ? <FieldErrorMessage message={error} /> : null}
    </div>
  );
}

CheckboxField.displayName = "CheckboxField";
