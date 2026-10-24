import * as React from "react";
import { User } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback, type AvatarProps } from "./Avatar";
import { cn } from "../utils";

export const USER_STATUS_COLORS = {
  online: "bg-success",
  offline: "bg-muted-foreground/40",
  busy: "bg-destructive",
  away: "bg-warning",
} as const;

export function getInitials(name: string | null | undefined, length = 2): string {
  if (!name) return "?";
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((namePart) => namePart[0])
      .join("")
      .slice(0, length)
      .toUpperCase() || "?"
  );
}

export interface UserAvatarProps {
  id?: string | number;
  name?: string | null;
  avatar?: string | null;
  gender?: string | null;
  size?: AvatarProps["size"];
  status?: keyof typeof USER_STATUS_COLORS;
  statusAriaLabel?: string;
  badgeNode?: React.ReactNode;
  showTooltip?: boolean;
  isLoading?: boolean;
  className?: string;
  fallbackClassName?: string;
  /** Optional theme or domain-specific fallback color resolver (e.g. gender or deterministic palette). */
  fallbackColorResolver?: (gender?: string | null, id?: string | number | null) => string;
}

export function UserAvatar({
  id,
  name,
  avatar,
  gender,
  size,
  status,
  statusAriaLabel,
  badgeNode,
  showTooltip = false,
  isLoading = false,
  className,
  fallbackClassName,
  fallbackColorResolver,
}: UserAvatarProps): React.JSX.Element {
  if (isLoading) {
    return (
      <div
        className={cn(
          "rounded-xl bg-muted/60 animate-pulse motion-reduce:animate-none border border-border/40 shrink-0",
          size === "sm" && "h-7 w-7",
          size === "lg" && "h-11 w-11",
          size === "xl" && "h-16 w-16",
          size === "2xl" && "h-20 w-20",
          (!size || size === "md") && "h-9 w-9",
          className,
        )}
        aria-hidden="true"
      />
    );
  }

  const initials = getInitials(name, 2);
  const colorClass = fallbackColorResolver
    ? fallbackColorResolver(gender, id)
    : id
      ? "bg-primary/15 text-primary"
      : "bg-muted text-muted-foreground";
  const tooltipText = showTooltip && name ? name : undefined;

  return (
    <div className="relative inline-flex shrink-0" title={tooltipText}>
      <Avatar size={size} className={className}>
        {avatar && <AvatarImage src={avatar} alt={name || "Avatar"} />}
        <AvatarFallback className={cn(colorClass, fallbackClassName)}>
          {initials && initials !== "?" ? (
            initials
          ) : (
            <User className="h-1/2 w-1/2 opacity-70" aria-hidden="true" />
          )}
        </AvatarFallback>
      </Avatar>

      {status ? (
        <>
          <span
            className={cn(
              "absolute -bottom-0.5 -end-0.5 rounded-full ring-2 ring-card shrink-0",
              USER_STATUS_COLORS[status],
              size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5",
            )}
            aria-hidden="true"
          />
          <span className="sr-only">{statusAriaLabel || status}</span>
        </>
      ) : badgeNode ? (
        <div className="absolute -bottom-1 -end-1 shrink-0">{badgeNode}</div>
      ) : null}
    </div>
  );
}
