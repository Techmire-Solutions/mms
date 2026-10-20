import * as React from "react";
import { cn } from "../utils";
import { CARD_SURFACE } from "../theme/formStyles";

export const CARD_STRIPE_WIDTH = "w-1.5";
export const CARD_STRIPE_INSET = "ps-5 sm:ps-6";
export const CARD_STRIPE_BASE = "absolute inset-y-0 start-0 w-1.5";

export type CardAccentColor =
  "primary" | "success" | "destructive" | "warning" | "info" | "secondary" | "muted" | string;

export const CARD_STRIPE_COLORS: Record<string, string> = {
  primary: "bg-primary/45 group-hover/card:bg-primary",
  success: "bg-success/45 group-hover/card:bg-success",
  warning: "bg-warning/45 group-hover/card:bg-warning",
  destructive: "bg-destructive/45 group-hover/card:bg-destructive",
  info: "bg-info/45 group-hover/card:bg-info",
  secondary: "bg-secondary/45 group-hover/card:bg-secondary",
  muted: "bg-muted-foreground/35 group-hover/card:bg-muted-foreground",
  // Common aliases
  danger: "bg-destructive/45 group-hover/card:bg-destructive",
  error: "bg-destructive/45 group-hover/card:bg-destructive",
  warn: "bg-warning/45 group-hover/card:bg-warning",
  gray: "bg-muted-foreground/35 group-hover/card:bg-muted-foreground",
  neutral: "bg-muted-foreground/35 group-hover/card:bg-muted-foreground",
  blue: "bg-info/45 group-hover/card:bg-info",
  green: "bg-success/45 group-hover/card:bg-success",
  red: "bg-destructive/45 group-hover/card:bg-destructive",
  yellow: "bg-warning/45 group-hover/card:bg-warning",
  amber: "bg-warning/45 group-hover/card:bg-warning",
};

export function getCardStripeClass(color?: string): string {
  if (!color || color === "none") return "";
  return CARD_STRIPE_COLORS[color] ?? CARD_STRIPE_COLORS.primary;
}

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  accentColor?: CardAccentColor | "none" | false | null;
  interactive?: boolean;
}

export type CardHeaderProps = React.HTMLAttributes<HTMLDivElement>;

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "div";
}

export type CardDescriptionProps = React.HTMLAttributes<HTMLParagraphElement>;
export type CardContentProps = React.HTMLAttributes<HTMLDivElement>;
export type CardFooterProps = React.HTMLAttributes<HTMLDivElement>;

export const Card = ({
  ref,
  className,
  accentColor = "primary",
  interactive = false,
  tabIndex,
  role,
  ...props
}: CardProps & { ref?: React.Ref<HTMLDivElement> }) => {
  const hasStripe = accentColor && accentColor !== "none";
  return (
    <div
      ref={ref}
      tabIndex={interactive ? (tabIndex ?? 0) : tabIndex}
      role={interactive ? (role ?? "button") : role}
      className={cn(
        CARD_SURFACE,
        interactive &&
          "cursor-pointer focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-hidden active:scale-tap-micro hover:border-foreground/20",
        hasStripe && CARD_STRIPE_INSET,
        className,
      )}
      {...props}
    >
      {hasStripe && (
        <div
          aria-hidden="true"
          className={cn(
            CARD_STRIPE_BASE,
            "transition-colors duration-150 ease-out",
            getCardStripeClass(accentColor as string),
          )}
        />
      )}
      {props.children}
    </div>
  );
};
Card.displayName = "Card";

export const CardHeader = ({
  ref,
  className,
  ...props
}: CardHeaderProps & { ref?: React.Ref<HTMLDivElement> }) => (
  <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
);
CardHeader.displayName = "CardHeader";

export const CardTitle = ({
  ref,
  className,
  as: Component = "h3",
  ...props
}: CardTitleProps & { ref?: React.Ref<HTMLHeadingElement> }) => (
  <Component
    ref={ref}
    className={cn(
      "font-semibold leading-none tracking-tight text-card-foreground text-balance break-words",
      className,
    )}
    {...props}
  />
);
CardTitle.displayName = "CardTitle";

export const CardDescription = ({
  ref,
  className,
  ...props
}: CardDescriptionProps & { ref?: React.Ref<HTMLParagraphElement> }) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground text-pretty break-words", className)}
    {...props}
  />
);
CardDescription.displayName = "CardDescription";

export const CardContent = ({
  ref,
  className,
  ...props
}: CardContentProps & { ref?: React.Ref<HTMLDivElement> }) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
);
CardContent.displayName = "CardContent";

export const CardFooter = ({
  ref,
  className,
  ...props
}: CardFooterProps & { ref?: React.Ref<HTMLDivElement> }) => (
  <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
);
CardFooter.displayName = "CardFooter";
