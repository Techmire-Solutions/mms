import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "../utils";

/**
 * Solid fills use `--button-<role>-hover/active` instead of `bg-<role>/90`.
 * The old alpha hover composited against whatever surface sat behind the button,
 * so the same variant could pass on the card and fail on the dark card (success
 * hover was 4.34:1). The tokens are mode-matched and surface-independent.
 *
 * `disabled:bg-<role>` is the hover/active reset: a disabled button still matches
 * `:hover` in every engine, and Tailwind emits `:disabled` after `:hover`, so this
 * single class suppresses both without raising specificity for enabled buttons.
 */
const SOLID_PRIMARY =
  "bg-primary text-primary-foreground shadow-surface hover:bg-button-primary-hover active:bg-button-primary-active disabled:bg-primary";
const SOLID_SECONDARY =
  "bg-secondary text-secondary-foreground shadow-surface hover:bg-button-secondary-hover active:bg-button-secondary-active disabled:bg-secondary";
const SOLID_DESTRUCTIVE =
  "bg-destructive text-destructive-foreground shadow-surface hover:bg-button-destructive-hover active:bg-button-destructive-active disabled:bg-destructive";
const SOLID_SUCCESS =
  "bg-success text-success-foreground shadow-surface hover:bg-button-success-hover active:bg-button-success-active disabled:bg-success";

const TINTED_MUTED =
  "text-muted-foreground hover:text-foreground hover:bg-muted/30 disabled:bg-transparent disabled:text-muted-foreground";

/**
 * Slot children (links) have no native `disabled`, so the ARIA state carries the
 * interaction styling. Kept out of the cva base: an `aria-disabled` native button
 * would match these too, and `pointer-events-none` would suppress its
 * `cursor-not-allowed`.
 */
const SLOT_DISABLED_CLASS =
  "aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:pointer-events-none";

/** Capsule primary is a flat chip, not an elevated action button. */
const SOLID_PRIMARY_FLAT =
  "bg-primary text-primary-foreground shadow-none hover:bg-button-primary-hover active:bg-button-primary-active disabled:bg-primary";

export const buttonVariants = cva(
  [
    "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium",
    "cursor-pointer select-none touch-manipulation",
    // `transition` includes transform/scale, so the pressed scale animates; the
    // repo's motion token keeps it at 150ms and reduced motion opts out.
    "transition duration-fast ease-calm motion-reduce:transition-none",
    "active:scale-tap disabled:scale-100",
    // `ring-offset-background` is mandatory: Tailwind's default white offset is
    // 1.95:1 against the dark ring (WCAG 1.4.11 needs 3:1).
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        default: SOLID_PRIMARY,
        primary: SOLID_PRIMARY,
        destructive: SOLID_DESTRUCTIVE,
        danger: SOLID_DESTRUCTIVE,
        outline:
          "border border-input bg-transparent text-foreground shadow-none hover:bg-muted hover:text-foreground active:bg-muted/80 disabled:bg-transparent",
        secondary: SOLID_SECONDARY,
        ghost:
          "text-foreground shadow-none hover:bg-muted hover:text-foreground active:bg-muted/80 disabled:bg-transparent",
        link: "text-primary font-semibold underline-offset-4 shadow-none hover:underline active:translate-y-px active:scale-100 disabled:no-underline touch-target-coarse",
        success: SOLID_SUCCESS,
        capsPrimary: SOLID_PRIMARY_FLAT,
        capsOutline:
          "border border-border/60 bg-card/50 text-muted-foreground shadow-none hover:bg-muted/30 hover:text-foreground disabled:bg-card/50 disabled:text-muted-foreground",
        capsGhost: `${TINTED_MUTED} shadow-none`,
        capsSuccess:
          "border border-success/30 bg-success/10 text-success shadow-none hover:bg-success/15 hover:text-success disabled:bg-success/10 disabled:text-success",
        capsDestructive:
          "border border-destructive/30 bg-destructive/10 text-destructive shadow-none hover:bg-destructive/15 hover:text-destructive disabled:bg-destructive/10 disabled:text-destructive",
        capsAccent:
          "border border-primary/20 bg-primary/10 text-primary shadow-none hover:bg-primary/15 hover:text-primary disabled:bg-primary/10 disabled:text-primary",
      },
      size: {
        default: "min-h-11 h-11 px-4 py-2",
        md: "min-h-11 h-11 px-4 py-2",
        sm: "min-h-11 h-11 px-3 text-xs",
        lg: "min-h-11 h-12 px-8 text-base",
        xl: "min-h-11 px-6 text-base",
        icon: "min-h-11 min-w-11 h-11 w-11",
        // `tracking-wider` is a Latin typographic choice; letter-spacing breaks
        // Arabic/Urdu joining, so caps labels keep normal tracking in RTL
        // (2026-10-31 review). `uppercase` is a no-op for those scripts.
        caps: "min-h-11 h-auto px-3 py-2 text-xs font-bold uppercase tracking-wider rtl:tracking-normal gap-1.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
  loading?: boolean;
  loadingText?: React.ReactNode;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }> | null;
  ref?: React.Ref<HTMLButtonElement>;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      isLoading = false,
      loading = false,
      loadingText,
      leftIcon,
      rightIcon,
      icon: Icon = null,
      disabled = false,
      title,
      "aria-label": ariaLabel,
      "aria-busy": ariaBusy,
      "aria-disabled": ariaDisabled,
      onClick,
      children,
      ...props
    },
    ref,
  ) => {
    const isBusy = isLoading || loading;
    const isDisabled = disabled || isBusy;
    const hasLoadingText = loadingText != null && loadingText !== "";
    const resolvedAriaLabel = ariaLabel || (typeof title === "string" ? title : undefined);
    const resolvedAriaBusy = isBusy ? true : ariaBusy;
    const resolvedAriaDisabled = isDisabled ? true : ariaDisabled;
    const Comp = asChild ? Slot : "button";
    const classes = cn(
      buttonVariants({ variant, size, className }),
      asChild && SLOT_DISABLED_CLASS,
    );

    /**
     * `asChild` has no native disabled attribute, so block activation in React and
     * expose the state through ARIA. Real <button> users keep the native attribute,
     * which is what stops a pending submit button from firing twice.
     */
    const guardSlotClick = (event: React.MouseEvent<HTMLElement>) => {
      if (isDisabled) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      onClick?.(event as React.MouseEvent<HTMLButtonElement>);
    };

    if (asChild) {
      return (
        <Comp
          className={classes}
          ref={ref}
          title={title}
          aria-label={resolvedAriaLabel}
          aria-busy={resolvedAriaBusy}
          aria-disabled={resolvedAriaDisabled}
          data-loading={isBusy ? "true" : undefined}
          onClick={guardSlotClick}
          {...props}
        >
          {children}
        </Comp>
      );
    }

    return (
      <Comp
        className={classes}
        ref={ref}
        title={title}
        disabled={isDisabled}
        aria-label={resolvedAriaLabel}
        aria-busy={resolvedAriaBusy}
        aria-disabled={resolvedAriaDisabled}
        data-loading={isBusy ? "true" : undefined}
        onClick={onClick}
        {...props}
      >
        {/*
         * Loading keeps the original content mounted (and width reserved) instead
         * of swapping it for a spinner. The content is `opacity-0` rather than
         * `invisible`: opacity 0 is excluded from axe's contrast scan but still
         * contributes the accessible name, so a button never loses its label just
         * because it is busy. When `loadingText` is supplied it becomes the visible
         * label, so the old label is hidden from the accessibility tree instead.
         */}
        <span className="relative inline-flex items-center justify-center gap-2">
          <span
            data-slot="button-content"
            className={cn("inline-flex items-center justify-center gap-2", isBusy && "opacity-0")}
            aria-hidden={isBusy && hasLoadingText ? true : undefined}
          >
            {leftIcon}
            {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
            {children}
            {rightIcon}
          </span>
          {isBusy ? (
            <span
              data-slot="button-loading"
              className="absolute inset-0 inline-flex items-center justify-center gap-2"
            >
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
              {hasLoadingText ? loadingText : null}
            </span>
          ) : null}
        </span>
      </Comp>
    );
  },
);
Button.displayName = "Button";
