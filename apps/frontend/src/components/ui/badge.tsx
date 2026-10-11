import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { SEMANTIC_BADGE } from "@/lib/semanticTone";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-xs hover:bg-primary/80",
        primary:
          "border-transparent bg-primary text-primary-foreground shadow-xs hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/80",
        outline: "text-foreground",
      },
      size: {
        sm: "px-2 py-0.5 text-3xs gap-1",
        md: "px-2.5 py-0.5 text-xs gap-1.5",
        lg: "px-3 py-1 text-sm gap-2",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

export type BadgeTone =
  "primary" | "success" | "destructive" | "warning" | "info" | "secondary" | "muted";

const BADGE_TONES: Record<BadgeTone, string> = {
  primary: "bg-primary/10 text-primary border-primary/20",
  success: SEMANTIC_BADGE.success,
  destructive: SEMANTIC_BADGE.destructive,
  warning: SEMANTIC_BADGE.warning,
  info: SEMANTIC_BADGE.info,
  secondary: SEMANTIC_BADGE.secondary,
  muted: SEMANTIC_BADGE.muted,
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLElement>, VariantProps<typeof badgeVariants> {
  /** Soft semantic tone — wins over `variant` when set. */
  tone?: BadgeTone;
  /** Rounded-full pill shape. */
  pill?: boolean;
  /** Render element — `span` for inline/table-cell pills, `button` for clickable chips. */
  as?: "div" | "span" | "button";
  /** HTML button type when `as="button"`. Defaults to "button". */
  type?: "button" | "submit" | "reset";
  /** Optional status indicator dot. */
  dot?: boolean;
  /** Whether the indicator dot pulses. */
  pulse?: boolean;
  /** Optional remove/dismiss callback rendering an X button (44px hit area). */
  onRemove?: () => void;
  /** Accessible label for the remove button. Defaults to "Remove". */
  removeAriaLabel?: string;
}

/**
 * Badge — SSOT for status/tag pills. Solid `variant` for filled chrome,
 * `tone` for soft semantic pills, `pill` for the rounded-full shape.
 */
const Badge = React.forwardRef<HTMLElement, BadgeProps>(function Badge(
  {
    className,
    variant,
    size,
    tone,
    pill = false,
    dot = false,
    pulse = false,
    onRemove,
    removeAriaLabel = "Remove",
    as: Comp = "div",
    children,
    onClick,
    type,
    ...props
  },
  ref,
) {
  const isInteractive = Comp === "button" || Boolean(onClick);
  const buttonType = Comp === "button" ? (type ?? "button") : undefined;

  return (
    <Comp
      ref={ref as never}
      type={buttonType}
      onClick={onClick}
      className={cn(
        badgeVariants({ variant, size }),
        tone && BADGE_TONES[tone],
        pill && "rounded-full",
        isInteractive &&
          "cursor-pointer select-none active:scale-95 hover:opacity-90 transition-transform",
        className,
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn("h-1.5 w-1.5 rounded-full bg-current shrink-0", pulse && "animate-pulse")}
          aria-hidden="true"
        />
      )}
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="relative ms-0.5 -me-1 inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-foreground/15 transition-colors before:absolute before:-inset-3 before:content-['']"
          aria-label={removeAriaLabel}
        >
          <X className="h-2.5 w-2.5" aria-hidden="true" />
        </button>
      )}
    </Comp>
  );
});
Badge.displayName = "Badge";

export { Badge, badgeVariants };
