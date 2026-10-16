import React from "react";
import {
  StatusBadge as SharedStatusBadge,
  type StatusBadgeProps as SharedStatusBadgeProps,
  type StatusBadgeConfigItem,
} from "@shared/ui";
import { useTranslation } from "@/hooks/useTranslation";
import type { AppTranslationKey } from "@mms/shared";

export type { StatusBadgeConfigItem };
export type StatusBadgeProps = SharedStatusBadgeProps;

const STATUS_KEYS: Record<string, AppTranslationKey> = {
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

/**
 * Localized facade for StatusBadge in Tenant Console.
 * Injects translated strings via `useTranslation()` and delegates rendering to `@shared/ui`.
 */
export function StatusBadge({ status, config, ...props }: StatusBadgeProps): React.JSX.Element {
  const { t } = useTranslation();

  const labelKey = STATUS_KEYS[status];
  const translatedLabel = labelKey ? t(labelKey) : undefined;

  const mergedConfig: Record<string, StatusBadgeConfigItem> = {
    ...(translatedLabel ? { [status]: { label: translatedLabel, cls: "" } } : {}),
    ...config,
  };

  return <SharedStatusBadge status={status} config={mergedConfig} {...props} />;
}

StatusBadge.displayName = "StatusBadge";
