import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../utils";

export const avatarVariants = cva(
  "relative flex shrink-0 overflow-hidden rounded-xl border border-border/40 shadow-xs transition-all",
  {
    variants: {
      size: {
        sm: "h-7 w-7 text-3xs",
        md: "h-9 w-9 text-xs",
        lg: "h-11 w-11 text-sm",
        xl: "h-16 w-16 text-lg",
        "2xl": "h-20 w-20 text-2xl",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

export interface AvatarProps
  extends React.ComponentProps<typeof AvatarPrimitive.Root>, VariantProps<typeof avatarVariants> {}

export function Avatar({ className, size, ref, ...props }: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      ref={ref}
      className={cn(avatarVariants({ size }), className)}
      {...props}
    />
  );
}

export interface AvatarImageProps extends React.ComponentProps<typeof AvatarPrimitive.Image> {
  fetchPriority?: "high" | "low" | "auto";
}

/**
 * Modern Web Guidance: optimize-image-priority
 * Standardizes async decoding, defaults loading to lazy unless fetchPriority is high.
 */
export function AvatarImage({
  className,
  ref,
  loading,
  decoding = "async",
  fetchPriority,
  ...props
}: AvatarImageProps) {
  const resolvedLoading = loading ?? (fetchPriority === "high" ? "eager" : "lazy");
  return (
    <AvatarPrimitive.Image
      ref={ref}
      loading={resolvedLoading}
      decoding={decoding}
      fetchPriority={fetchPriority}
      className={cn(
        "aspect-square h-full w-full object-cover transition-opacity duration-200",
        className,
      )}
      {...props}
    />
  );
}

export function AvatarFallback({
  className,
  ref,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      ref={ref}
      className={cn(
        "flex h-full w-full items-center justify-center rounded-xl bg-muted font-bold select-none leading-none",
        className,
      )}
      {...props}
    />
  );
}
