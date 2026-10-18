import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "../utils";

export const badgeVariants = cva(
  "inline-flex items-center rounded-md border font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 [text-box:trim-both_cap_alphabetic]",
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
        outline: "text-foreground border-border",
        success: "border-transparent bg-success/15 text-success hover:bg-success/20",
        warning: "border-transparent bg-warning/15 text-warning hover:bg-warning/20",
        info: "border-transparent bg-info/15 text-info hover:bg-info/20",
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

export type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];

export type BadgeTone =
  "primary" | "success" | "destructive" | "warning" | "info" | "secondary" | "muted";

export const BADGE_TONES: Record<BadgeTone, string> = {
  primary: "bg-primary/10 text-primary border-primary/20",
  success: "bg-success/10 text-success border-success/20",
  destructive: "bg-destructive/10 text-destructive border-destructive/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  info: "bg-info/10 text-info border-info/20",
  secondary: "bg-secondary/10 text-secondary border-secondary/20",
  muted: "bg-muted text-muted-foreground border-border",
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLElement>, VariantProps<typeof badgeVariants> {
  ref?: React.Ref<HTMLElement>;
  tone?: BadgeTone;
  pill?: boolean;
  as?: "div" | "span" | "button";
  type?: "button" | "submit" | "reset";
  dot?: boolean;
  pulse?: boolean;
  onRemove?: () => void;
  removeAriaLabel?: string;
}

export function Badge({
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
  ref,
  ...props
}: BadgeProps): React.JSX.Element {
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
}
Badge.displayName = "Badge";
