import * as React from "react";
import { cn } from "../utils";

export type SpinnerSize = "xs" | "sm" | "md" | "lg" | "xl";
export type SpinnerVariant = "primary" | "current" | "muted" | "white";

export interface SpinnerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /** Diameter sizing tier (xs: 14px, sm: 16px, md: 24px, lg: 32px, xl: 40px) */
  size?: SpinnerSize;
  /** Palette color variant */
  variant?: SpinnerVariant;
  /** Accessible label announced to assistive technologies (default: "Loading") */
  label?: string;
  /** When true, displays visible label text beside the spinner */
  showLabel?: boolean;
  /** Container custom classes */
  className?: string;
  ref?: React.Ref<HTMLDivElement>;
}

const sizeClasses: Record<SpinnerSize, string> = {
  xs: "size-3.5 border-[1.5px]",
  sm: "size-4 border-2",
  md: "size-6 border-2",
  lg: "size-8 border-[2.5px]",
  xl: "size-10 border-3",
};

const variantClasses: Record<SpinnerVariant, string> = {
  primary: "text-primary border-primary/20 border-t-primary",
  current: "text-current border-current/20 border-t-current",
  muted: "text-muted-foreground border-muted-foreground/20 border-t-muted-foreground",
  white: "text-white border-white/30 border-t-white",
};

/**
 * Modern Web Guidance: spinner
 * Indeterminate progress spinner with native <progress> semantics,
 * accessible announcements, and motion-safe reduced-motion easing.
 */
export function Spinner({
  size = "md",
  variant = "primary",
  label = "Loading",
  showLabel = false,
  className,
  ref,
  ...props
}: SpinnerProps): React.JSX.Element {
  return (
    <div
      ref={ref}
      role="status"
      aria-label={showLabel ? undefined : label}
      className={cn("inline-flex items-center gap-2", className)}
      {...props}
    >
      <progress
        aria-label={label}
        data-loading-spinner=""
        className={cn(
          "loading-spinner shrink-0 rounded-full animate-spin motion-reduce:animate-[spin_3s_linear_infinite] transition-colors",
          sizeClasses[size],
          variantClasses[variant],
        )}
      />
      {showLabel ? (
        <span className="text-sm font-medium text-muted-foreground select-none">{label}</span>
      ) : (
        <span className="sr-only">{label}</span>
      )}
    </div>
  );
}

Spinner.displayName = "Spinner";
