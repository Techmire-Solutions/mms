import React from "react";
import type { AppTranslationKey } from "@mms/shared";
import { cn } from "@/lib/utils";
import { SEMANTIC_BADGE } from "@/lib/semanticTone";
import { useTranslation } from "@/hooks/useTranslation";
import { Badge } from "@/components/ui/badge";

export interface StatusBadgeConfigItem {
  label: string;
  cls: string;
  dot?: string;
}

export interface StatusBadgeProps {
  status: string;
  config?: Record<string, StatusBadgeConfigItem>;
  size?: "sm" | "md";
  /** When set, renders a button and stops click propagation (directory row safe). */
  onClick?: () => void;
}

const DEFAULT_CLS: Record<string, string> = {
  active: SEMANTIC_BADGE.success,
  inactive: SEMANTIC_BADGE.muted,
  suspended: SEMANTIC_BADGE.warning,
  graduated: SEMANTIC_BADGE.info,
  transferred: SEMANTIC_BADGE.infoStrong,
  confirmed: SEMANTIC_BADGE.success,
  pending: SEMANTIC_BADGE.warning,
  paid: SEMANTIC_BADGE.success,
  overdue: SEMANTIC_BADGE.destructive,
  partial: SEMANTIC_BADGE.info,
  none: SEMANTIC_BADGE.muted,
  cancelled: SEMANTIC_BADGE.muted,
  completed: SEMANTIC_BADGE.success,
  upcoming: SEMANTIC_BADGE.info,
  ongoing: SEMANTIC_BADGE.warning,
  success: SEMANTIC_BADGE.success,
  failed: SEMANTIC_BADGE.destructive,
  posted: SEMANTIC_BADGE.successStrong,
  draft: SEMANTIC_BADGE.muted,
  sent: SEMANTIC_BADGE.success,
  delivered: SEMANTIC_BADGE.successStrong,
  skipped: SEMANTIC_BADGE.muted,
};

export const StatusBadge = (function StatusBadge({
  status,
  config = {},
  size = "md",
  onClick,
}: StatusBadgeProps): React.ReactElement {
  const { t } = useTranslation();

  const defaultConfig = (() => {
    const labels: Record<string, AppTranslationKey> = {
      active: "statusBadge.active",
      inactive: "statusBadge.inactive",
      suspended: "statusBadge.suspended",
      graduated: "statusBadge.graduated",
      transferred: "statusBadge.transferred",
      confirmed: "statusBadge.confirmed",
      pending: "statusBadge.pending",
      paid: "statusBadge.paid",
      overdue: "statusBadge.overdue",
      partial: "statusBadge.partial",
      none: "statusBadge.none",
      cancelled: "statusBadge.cancelled",
      completed: "statusBadge.completed",
      upcoming: "statusBadge.upcoming",
      ongoing: "statusBadge.ongoing",
      success: "statusBadge.success",
      failed: "statusBadge.failed",
      posted: "statusBadge.posted",
      draft: "statusBadge.draft",
      sent: "statusBadge.sent",
      delivered: "statusBadge.delivered",
      skipped: "statusBadge.skipped",
    };
    const built: Record<string, StatusBadgeConfigItem> = {};
    for (const [key, labelKey] of Object.entries(labels)) {
      built[key] = { label: t(labelKey), cls: DEFAULT_CLS[key] ?? SEMANTIC_BADGE.muted };
    }
    return built;
  })() as Record<string, StatusBadgeConfigItem>;

  const badgeConfigByStatus = { ...defaultConfig, ...(config || {}) };
  const badgeConfig = badgeConfigByStatus[status] || { label: status, cls: SEMANTIC_BADGE.muted };
  const content = (
    <>
      {badgeConfig.dot && (
        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", badgeConfig.dot)} aria-hidden="true" />
      )}
      {badgeConfig.label}
    </>
  );

  return (
    <Badge
      as={onClick ? "button" : "span"}
      size={size}
      onClick={
        onClick
          ? (event) => {
              event.stopPropagation();
              onClick();
            }
          : undefined
      }
      className={cn("font-bold text-xs", badgeConfig.cls)}
    >
      {content}
    </Badge>
  );
});
