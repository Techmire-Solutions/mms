import * as React from "react";
import { cn } from "../utils";

export interface ScrollProgressIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

/**
 * Modern Web Guidance: scroll-progress-indicator
 * Pure CSS scroll-driven reading/scroll progress bar.
 * Uses animation-timeline: scroll() where supported; degrades gracefully to hidden.
 * Always sets aria-hidden="true" to remove purely decorative indicator from the AT tree.
 */
export function ScrollProgressIndicator({
  className,
  ...props
}: ScrollProgressIndicatorProps): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "fixed inset-inline-0 top-0 z-sticky h-0.5 bg-primary scroll-progress-bar pointer-events-none",
        className,
      )}
      {...props}
    />
  );
}

ScrollProgressIndicator.displayName = "ScrollProgressIndicator";
