import React, { useId } from "react";
import { Switch } from "./Switch";
import { Label } from "./Label";
import { cn } from "../utils";

export type ToggleRowVariant = "default" | "card" | "bordered";

export interface ToggleRowProps {
  /** Optional HTML element id for associating label and switch. */
  id?: string;
  /** Primary label content. */
  label: React.ReactNode;
  /** Secondary description text. */
  description?: React.ReactNode;
  /** Controlled boolean state (Radix-standard alias for value). */
  checked?: boolean;
  /** Legacy alias for checked. */
  value?: boolean;
  /** Callback fired on state change (Radix-standard alias for onChange). */
  onCheckedChange?: (checked: boolean) => void;
  /** Legacy alias for onCheckedChange. */
  onChange?: (checked: boolean) => void;
  /** Whether the control is disabled. */
  disabled?: boolean;
  /** Visual presentation style. */
  variant?: ToggleRowVariant;
  /** Explicit aria-label if label is complex JSX. */
  ariaLabel?: string;
  /** Custom container class overrides. */
  className?: string;
}

/**
 * Universal ToggleRow primitive for settings, feature preferences, and forms.
 * Combines an accessible label and optional description with a toggle switch.
 */
export function ToggleRow({
  id: explicitId,
  label,
  description,
  checked,
  value,
  onCheckedChange,
  onChange,
  disabled = false,
  variant = "default",
  ariaLabel,
  className,
}: ToggleRowProps): React.JSX.Element {
  const generatedId = useId();
  const id = explicitId || generatedId;
  const isChecked = checked ?? value ?? false;

  const handleChange = (nextChecked: boolean) => {
    onCheckedChange?.(nextChecked);
    onChange?.(nextChecked);
  };

  const stringAriaLabel =
    ariaLabel ?? (typeof label === "string" ? label : undefined);

  if (variant === "card") {
    return (
      <div
        className={cn(
          "flex items-center justify-between gap-4 rounded-xl border px-3.5 py-3.5 transition-colors text-start",
          isChecked
            ? "border-primary/20 bg-primary/5"
            : "border-border/60 bg-muted/10 hover:border-border hover:bg-muted/20",
          disabled && "opacity-60 pointer-events-none",
          className,
        )}
      >
        <div className="min-w-0 flex-1">
          <Label
            htmlFor={id}
            className="text-sm font-semibold text-foreground cursor-pointer"
          >
            {label}
          </Label>
          {description ? (
            <p id={`${id}-desc`} className="mt-0.5 text-xs text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        <Switch
          id={id}
          checked={isChecked}
          onCheckedChange={handleChange}
          disabled={disabled}
          aria-label={stringAriaLabel}
          aria-describedby={description ? `${id}-desc` : undefined}
        />
      </div>
    );
  }

  if (variant === "bordered") {
    return (
      <div
        className={cn(
          "flex items-center justify-between gap-4 p-3 rounded-lg border border-border bg-card/50 text-start",
          disabled && "opacity-60 pointer-events-none",
          className,
        )}
      >
        <div className="min-w-0 flex-1 space-y-0.5">
          <Label
            htmlFor={id}
            className="text-xs font-medium cursor-pointer text-foreground"
          >
            {label}
          </Label>
          {description ? (
            <p id={`${id}-desc`} className="text-3xs text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        <Switch
          id={id}
          checked={isChecked}
          onCheckedChange={handleChange}
          disabled={disabled}
          aria-label={stringAriaLabel}
          aria-describedby={description ? `${id}-desc` : undefined}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-11 items-center justify-between gap-3 py-1.5 text-start",
        disabled && "opacity-60 pointer-events-none",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <Label
          htmlFor={id}
          className="text-sm font-semibold text-foreground cursor-pointer block"
        >
          {label}
        </Label>
        {description ? (
          <p id={`${id}-desc`} className="text-xs text-muted-foreground mt-0.5">
            {description}
          </p>
        ) : null}
      </div>
      <Switch
        id={id}
        checked={isChecked}
        onCheckedChange={handleChange}
        disabled={disabled}
        aria-label={stringAriaLabel}
        aria-describedby={description ? `${id}-desc` : undefined}
      />
    </div>
  );
}

export default ToggleRow;
