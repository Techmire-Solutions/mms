import * as React from "react";
import { User } from "lucide-react";
import { getInitials } from "@mms/shared";
import { Avatar, AvatarImage, AvatarFallback, type AvatarProps } from "@/components/ui/avatar";
import { getGenderAvatarFallbackClass } from "@/lib/ui/genderUi";
import { cn } from "@/lib/utils";

const STATUS_COLORS = {
  online: "bg-success",
  offline: "bg-muted-foreground/40",
  busy: "bg-destructive",
  away: "bg-warning",
} as const;

export interface UserAvatarProps {
  id?: string | number;
  name?: string | null;
  avatar?: string | null;
  gender?: string | null;
  size?: AvatarProps["size"];
  status?: keyof typeof STATUS_COLORS;
  statusAriaLabel?: string;
  badgeNode?: React.ReactNode;
  showTooltip?: boolean;
  isLoading?: boolean;
  className?: string;
  fallbackClassName?: string;
}

export const UserAvatar = function UserAvatar({
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
}: UserAvatarProps): React.JSX.Element {
  if (isLoading) {
    return (
      <div
        className={cn(
          "rounded-xl bg-muted/60 animate-pulse border border-border/40 shrink-0",
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
  const colorClass = getGenderAvatarFallbackClass(gender, id);
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
              STATUS_COLORS[status],
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
};
