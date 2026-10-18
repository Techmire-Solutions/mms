import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "../utils";

export const buttonVariants = cva(
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer select-none",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        primary: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        danger: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline min-h-0 min-w-0 h-auto p-0 font-semibold",
        success: "bg-success text-success-foreground shadow-sm hover:bg-success/90",
        capsPrimary: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
        capsOutline:
          "border border-border/60 bg-card/50 text-muted-foreground hover:text-foreground hover:bg-muted/30 shadow-none",
        capsGhost: "text-muted-foreground hover:text-foreground hover:bg-muted/30 shadow-none",
        capsSuccess:
          "border border-success/30 bg-success/10 text-success hover:bg-success/15 hover:text-success shadow-none",
        capsDestructive:
          "border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive shadow-none",
        capsAccent:
          "border border-primary/20 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary shadow-none",
      },
      size: {
        default: "min-h-11 h-11 px-4 py-2",
        md: "min-h-11 h-11 px-4 py-2",
        sm: "min-h-11 h-11 rounded-xl px-3 text-xs",
        lg: "min-h-11 h-12 rounded-xl px-8 text-base",
        xl: "min-h-11 px-6 text-base",
        icon: "min-h-11 min-w-11 h-11 w-11",
        caps: "min-h-11 h-auto rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-wider gap-1.5",
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
      children,
      ...props
    },
    ref,
  ) => {
    const isBusy = isLoading || loading;
    const resolvedAriaLabel = ariaLabel || (typeof title === "string" ? title : undefined);
    const Comp = asChild ? Slot : "button";

    if (asChild) {
      return (
        <Comp
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          title={title}
          aria-label={resolvedAriaLabel}
          {...props}
        >
          {children}
        </Comp>
      );
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        title={title}
        disabled={disabled || isBusy}
        aria-label={resolvedAriaLabel}
        aria-busy={isBusy ? "true" : undefined}
        {...props}
      >
        {isBusy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />
            {loadingText ?? children}
          </>
        ) : (
          <>
            {leftIcon}
            {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
            {children}
            {rightIcon}
          </>
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";
