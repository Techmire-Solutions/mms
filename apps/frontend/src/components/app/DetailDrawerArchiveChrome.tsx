import React from "react";
import { Archive } from "lucide-react";
import { formatDate } from "@mms/shared";
import { Alert } from "@/components/app/Alert";
import { formatEntityStamp } from "@/lib/formatEntityStamp";
import { useTranslation } from "@/hooks/useTranslation";
import {
  calculateRemainingRetentionDays,
  RetentionCountdownBadge,
  type RetentionCountdownBadgeProps,
} from "@/components/app/RetentionCountdownBadge";
import {
  DetailDrawerRestoreOrEditAction,
  type DetailDrawerRestoreOrEditActionProps,
} from "@/components/app/DetailDrawerRestoreOrEditAction";

export {
  calculateRemainingRetentionDays,
  RetentionCountdownBadge,
  DetailDrawerRestoreOrEditAction,
};
export type { RetentionCountdownBadgeProps, DetailDrawerRestoreOrEditActionProps };

export interface DetailDrawerArchivedBannerProps {
  deletedAt: unknown;
  purgeAfter?: unknown;
  /** Build banner description from a formatted date string (drawer chrome). */
  describe?: (formattedDate: string) => string;
  /** Optional title (directory cards); when set, takes precedence over describe-only layout. */
  title?: string;
  /** Optional body text (e.g. deletion reason on cards). */
  description?: string;
  /** Manifest retention policy in days (null = keep indefinitely). */
  retentionDays?: number | null;
}

/** Soft-delete archive banner for entity detail drawers and directory cards. */
export function DetailDrawerArchivedBanner({
  deletedAt,
  purgeAfter,
  describe,
  title,
  description,
  retentionDays,
}: DetailDrawerArchivedBannerProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const stamp = formatEntityStamp(deletedAt);
  if (!stamp) return null;

  const formatted = formatDate(stamp);
  let resolvedDescription =
    description ??
    (describe
      ? describe(formatted)
      : !title
        ? t("common.archivedOn", { date: formatted })
        : undefined);

  if (retentionDays !== undefined || purgeAfter !== undefined) {
    const remaining = calculateRemainingRetentionDays(deletedAt, retentionDays, purgeAfter);
    const retentionNote =
      remaining === null
        ? t("common.archivedIndefinitely")
        : remaining <= 7
          ? `⚠️ ${remaining === 1 ? t("common.purgesInOneDay") : t("common.purgesInDays", { count: remaining })}`
          : remaining === 1
            ? t("common.purgesInOneDay")
            : t("common.purgesInDays", { count: remaining });
    resolvedDescription = resolvedDescription
      ? `${resolvedDescription} • ${retentionNote}`
      : retentionNote;
  }

  if (!title && !resolvedDescription) return null;

  return (
    <Alert
      icon={Archive}
      density="compact"
      role="status"
      title={title}
      description={resolvedDescription}
    />
  );
}

export interface EntityArchivedBannerProps {
  deletedAt: unknown;
  deletionReason?: string | null;
  /** Localized title including formatted archive date. */
  titleWithDate: (formattedDate: string) => string;
  /** Localized label prefix for deletion reason (e.g. "Reason"). */
  reasonLabel: string;
  /** Manifest retention policy in days (null = keep indefinitely). */
  retentionDays?: number | null;
  /** Timestamp or ISO string when the record will be hard-purged. */
  purgeAfter?: unknown;
}

/**
 * Soft-delete archive banner shared by Contacts / Students (and peer directories).
 * Builds title + optional reason description; chrome via {@link DetailDrawerArchivedBanner}.
 */
export function EntityArchivedBanner({
  deletedAt,
  deletionReason,
  titleWithDate,
  reasonLabel,
  retentionDays,
  purgeAfter,
}: EntityArchivedBannerProps): React.JSX.Element | null {
  const stamp = formatEntityStamp(deletedAt);
  if (!stamp) return null;

  return (
    <DetailDrawerArchivedBanner
      deletedAt={deletedAt}
      retentionDays={retentionDays}
      purgeAfter={purgeAfter}
      title={titleWithDate(formatDate(stamp))}
      description={deletionReason ? `${reasonLabel}: ${deletionReason}` : undefined}
    />
  );
}

export interface DrawerSyncStatusFooterProps {
  isArchived: boolean;
  /** Localized "archived" status label shown when the entity is soft-deleted. */
  archivedLabel: string;
  /** Localized "synced" status label shown when the entity is active. */
  syncedLabel: string;
}

/**
 * Synced/archived status footer shared by entity detail drawers
 * (Students / Teachers / Sessions). Communicates state by text + color together (WCAG).
 */
export function DrawerSyncStatusFooter({
  isArchived,
  archivedLabel,
  syncedLabel,
}: DrawerSyncStatusFooterProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`w-1.5 h-1.5 rounded-full ${isArchived ? "bg-warning" : "bg-success"}`}
        aria-hidden="true"
      />
      <span
        className={`text-xs font-bold uppercase ${isArchived ? "text-warning" : "text-success"}`}
      >
        {isArchived ? archivedLabel : syncedLabel}
      </span>
    </div>
  );
}
