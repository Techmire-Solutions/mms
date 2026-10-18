import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "../utils";

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export interface TooltipContentProps extends React.ComponentProps<typeof TooltipPrimitive.Content> {
  /**
   * Whether to display a directional arrow indicator.
   * Modern Web Guidance: position-aware-tooltips.
   */
  showArrow?: boolean;
  /**
   * Optional custom className for the directional arrow.
   */
  arrowClassName?: string;
}

export function TooltipContent({
  className,
  sideOffset = 4,
  showArrow = false,
  arrowClassName,
  children,
  ref,
  ...props
}: TooltipContentProps) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          "z-popover overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className,
        )}
        {...props}
      >
        {children}
        {showArrow && <TooltipPrimitive.Arrow className={cn("fill-primary", arrowClassName)} />}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export const TooltipArrow = TooltipPrimitive.Arrow;
