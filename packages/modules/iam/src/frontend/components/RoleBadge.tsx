import React from "react";
import { Badge, type BadgeTone } from "@mms/ui";

const TONE_BY_VARIANT: Record<string, BadgeTone> = {
  primary: "primary",
  muted: "muted",
  warning: "warning",
  success: "success",
  destructive: "destructive",
};

export interface RoleBadgeProps {
  roleId: string;
  label?: string;
  variant?: string;
  platformManaged?: boolean;
  platformManagedLabel?: string;
}

/** Small, presentational IAM role badge. */
export function RoleBadge({
  roleId,
  label,
  variant,
  platformManaged,
  platformManagedLabel,
}: RoleBadgeProps): React.JSX.Element {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge as="span" size="sm" tone={TONE_BY_VARIANT[variant ?? "muted"] ?? "muted"}>
        {label ?? roleId}
      </Badge>
      {platformManaged && platformManagedLabel ? (
        <Badge as="span" size="sm" tone="muted">
          {platformManagedLabel}
        </Badge>
      ) : null}
    </span>
  );
}
