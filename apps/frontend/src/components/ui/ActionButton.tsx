import React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "destructive" | "outline";
  size?: "sm" | "md" | "lg" | "icon";
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }> | null;
  loading?: boolean;
  className?: string;
  children?: React.ReactNode;
  ref?: React.Ref<HTMLButtonElement>;
}

const VARIANT_MAP: Record<NonNullable<ActionButtonProps["variant"]>, NonNullable<ButtonProps["variant"]>> = {
  primary: "default",
  secondary: "outline",
  outline: "outline",
  ghost: "ghost",
  danger: "destructive",
  destructive: "destructive",
};

const SIZES: Record<NonNullable<ActionButtonProps["size"]>, string> = {
  sm: "min-h-11 px-3 py-2 text-xs gap-1.5",
  md: "min-h-11 px-3.5 py-2.5 text-sm gap-1.5",
  lg: "min-h-11 px-4 py-3 text-base gap-2",
  icon: "min-h-11 min-w-11 p-0",
};

/**
 * @deprecated Prefer using `Button` from `@/components/ui/button` directly with `variant` and `size`.
 * Retained as a backward-compatible adapter composing the canonical Button primitive.
 */
export function ActionButton({
  type = "button",
  variant = "secondary",
  size = "md",
  icon = null,
  loading = false,
  disabled = false,
  onClick = undefined,
  children = null,
  className = "",
  ref,
  ...props
}: ActionButtonProps) {
  return (
    <Button
      ref={ref}
      type={type}
      variant={VARIANT_MAP[variant] ?? "outline"}
      onClick={onClick}
      disabled={disabled || loading}
      loading={loading}
      icon={icon}
      className={cn(
        "font-semibold rounded-lg shadow-sm",
        variant === "secondary" && "bg-card text-foreground border-border hover:bg-muted",
        variant === "danger" && "bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 shadow-none",
        SIZES[size],
        className
      )}
      {...props}
    >
      {children}
    </Button>
  );
}
ActionButton.displayName = "ActionButton";

export type { ButtonProps };
