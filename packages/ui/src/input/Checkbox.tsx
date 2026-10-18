import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import { cn } from "../utils";

export interface CheckboxProps extends React.ComponentPropsWithoutRef<
  typeof CheckboxPrimitive.Root
> {
  error?: boolean;
}

/**
 * Accessible Checkbox component with 44x44px touch target, native indeterminate
 * state visual distinction (Modern Web Guidance: checkbox), and error states.
 */
export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, id, error, checked, ...props }, ref) => {
  const fallbackId = React.useId();
  const resolvedId = id || fallbackId;

  return (
    <CheckboxPrimitive.Root
      id={resolvedId}
      ref={ref}
      checked={checked}
      className={cn(
        "group peer relative h-4 w-4 shrink-0 cursor-pointer rounded-sm border border-primary shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground after:absolute after:start-1/2 after:top-1/2 after:h-11 after:w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']",
        error && "border-destructive focus-visible:ring-destructive",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-current")}>
        {checked === "indeterminate" ? (
          <Minus className="h-3 w-3 stroke-[3]" />
        ) : (
          <>
            <Check className="h-3.5 w-3.5 [[data-state=indeterminate]_&]:hidden" />
            <Minus className="hidden h-3 w-3 stroke-[3] [[data-state=indeterminate]_&]:block" />
          </>
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});
Checkbox.displayName = CheckboxPrimitive.Root.displayName;
