import React from "react";
import { formatEntityStamp } from "@/lib/formatEntityStamp";
import { useTranslation } from "@/hooks/useTranslation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Calculates remaining days before hard-purge based on deletedAt stamp and manifest retention policy or purgeAfter timestamp. */
export function calculateRemainingRetentionDays(
  deletedAt: unknown,
  retentionDays?: number | null,
  purgeAfter?: unknown,
): number | null {
  if (purgeAfter) {
    const purgeStamp = formatEntityStamp(purgeAfter);
    if (purgeStamp) {
      const purgeTime = new Date(purgeStamp).getTime();
      if (!Number.isNaN(purgeTime)) {
        const diffMs = purgeTime - Date.now();
        return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
      }
    }
  }
  if (retentionDays == null || Number.isNaN(Number(retentionDays))) return null;

  const stamp = formatEntityStamp(deletedAt);
  if (!stamp) return null;
  const deletedTime = new Date(stamp).getTime();
  if (Number.isNaN(deletedTime)) return null;
  const purgeTime = deletedTime + Number(retentionDays) * 24 * 60 * 60 * 1000;
  const diffMs = purgeTime - Date.now();
  return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
}

export interface RetentionCountdownBadgeProps {
  deletedAt: unknown;
  retentionDays?: number | null;
  purgeAfter?: unknown;
  className?: string;
}

/** Retention expiry countdown badge for trash directories and cards (§7.9). */
export function RetentionCountdownBadge({
  deletedAt,
  retentionDays,
  purgeAfter,
  className = "",
}: RetentionCountdownBadgeProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const stamp = formatEntityStamp(deletedAt);
  if (!stamp) return null;

  const remaining = calculateRemainingRetentionDays(deletedAt, retentionDays, purgeAfter);

  if (remaining === null) {
    return (
      <Badge as="span" tone="muted" size="sm" className={className}>
        {t("common.archivedIndefinitely")}
      </Badge>
    );
  }

  const isWarning = remaining <= 7;

  return (
    <Badge
      as="span"
      tone={isWarning ? "destructive" : "muted"}
      size="sm"
      className={cn(isWarning && "font-semibold", className)}
    >
      {isWarning ? "⚠️ " : ""}
      {remaining === 1
        ? t("common.purgesInOneDay")
        : t("common.purgesInDays", { count: remaining })}
    </Badge>
  );
}
