import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import { cn } from "../utils";

export interface CheckboxProps extends Omit<
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>,
  "onCheckedChange"
> {
  /**
   * Boolean-only change callback. Radix also emits `"indeterminate"`; narrowing it
   * here keeps every consumer from repeating `checked === true` casts (SSOT).
   */
  onCheckedChange?: (checked: boolean) => void;
  /** Marks the checkbox invalid and switches the focus ring to the destructive tone. */
  error?: boolean;
}

const CHECKBOX_BASE_CLASS =
  "group peer relative h-4 w-4 shrink-0 cursor-pointer rounded-sm border border-primary shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground after:absolute after:start-1/2 after:top-1/2 after:h-11 after:w-11 after:-translate-x-1/2 rtl:after:translate-x-1/2 after:-translate-y-1/2 after:content-['']";

/**
 * The single checkbox primitive for the whole product.
 *
 * - 44×44 px touch target via an `::after` overlay (the visual box stays 16 px).
 * - Native indeterminate state driven by Radix's `data-state`, rendered with a
 *   single CSS-only indicator pair (no duplicated conditional markup).
 * - Activation never bubbles to a clickable card/cell/row: Radix renders a hidden
 *   native input and clicks it, which otherwise double-toggled card-style
 *   checkboxes back to their previous value (2026-11-01 regression).
 * - `onCheckedChange` is normalised to a boolean at the primitive boundary.
 */
export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, id, error, checked, onCheckedChange, onClick, ...props }, ref) => {
  const fallbackId = React.useId();
  const resolvedId = id || fallbackId;

  return (
    <CheckboxPrimitive.Root
      id={resolvedId}
      ref={ref}
      checked={checked}
      aria-invalid={error || undefined}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.(event);
      }}
      onCheckedChange={(value) => onCheckedChange?.(value === true)}
      className={cn(
        CHECKBOX_BASE_CLASS,
        error && "border-destructive focus-visible:ring-destructive",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-current")}>
        <Check className="h-3.5 w-3.5 [[data-state=indeterminate]_&]:hidden" />
        <Minus className="hidden h-3 w-3 stroke-[3] [[data-state=indeterminate]_&]:block" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});
Checkbox.displayName = CheckboxPrimitive.Root.displayName;
