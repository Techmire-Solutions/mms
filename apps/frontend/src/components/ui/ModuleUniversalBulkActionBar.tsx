import type React from "react";
import { ModuleWorkBulkActionBar } from "@/components/ui/ModuleWorkBulkActionBar";
import {
  BulkSelectionStatusAction,
  type BulkSelectionMessageChannel,
} from "@/components/ui/BulkSelectionActions";
import type { StatusBadgeConfigItem } from "@/components/ui/StatusBadge";
import { useTranslation } from "@/hooks/useTranslation";
import { APP_TRANSLATIONS_EN, type AppTranslationKey } from "@mms/shared";

export interface ModuleUniversalBulkActionBarProps<T = unknown> {
  selectedCount: number;
  viewingDeleted: boolean;
  canWrite?: boolean;
  canDelete: boolean;
  canExport?: boolean;
  canWriteMessaging?: boolean;
  leadingIcon: React.ComponentType<{
    className?: string;
    "aria-hidden"?: boolean | "true" | "false";
  }>;
  i18nNamespace: string;
  bulkActions?: readonly string[];
  // Selection
  onClearSelection: () => void;
  // Delete / Restore
  deleteLabel?: string;
  restoreLabel?: string;
  onRequestBulkDelete: () => void;
  onRequestBulkRestore: () => void;
  // Status mutation
  statusConfig?: Record<string, StatusBadgeConfigItem>;
  onBulkStatusChange?: (status: string) => void;
  statusPending?: boolean;
  // Export
  exportLabel?: string;
  onBulkExport?: () => void;
  exportAction?: {
    label: string;
    onClick: () => void | Promise<void>;
    /** Export in flight — disables the CTA and shows a spinner. */
    isPending?: boolean;
  };
  // Messaging
  messagingTargets?: {
    waTargets: T[];
    smsReady: T[];
    emailReady: T[];
  };
  onWhatsApp?: (targets: T[]) => void;
  onSms?: (targets: T[]) => void;
  onEmail?: (targets: T[]) => void;
  // Custom extra action elements
  extraActions?: React.ReactNode;
}

/**
 * Universal Work bulk actions bar (SSOT).
 * Unifies messaging channel dispatch, status badge selection, export,
 * and bulk soft-delete/restore triggers across all MMS modules.
 */
export function ModuleUniversalBulkActionBar<T>({
  selectedCount,
  viewingDeleted,
  canWrite = true,
  canDelete,
  canExport = false,
  canWriteMessaging = false,
  leadingIcon: LeadingIcon,
  i18nNamespace,
  bulkActions,
  onClearSelection,
  deleteLabel,
  restoreLabel,
  onRequestBulkDelete,
  onRequestBulkRestore,
  statusConfig,
  onBulkStatusChange,
  statusPending = false,
  exportLabel,
  onBulkExport,
  exportAction,
  messagingTargets,
  onWhatsApp,
  onSms,
  onEmail,
  extraActions,
}: ModuleUniversalBulkActionBarProps<T>): React.JSX.Element | null {
  const { t } = useTranslation();

  if (selectedCount === 0) return null;

  const showWhatsApp = Boolean(
    bulkActions?.includes("whatsapp") && canWriteMessaging && onWhatsApp,
  );
  const showSms = Boolean(bulkActions?.includes("sms") && canWriteMessaging && onSms);
  const showEmail = Boolean(bulkActions?.includes("email") && canWriteMessaging && onEmail);
  const showMessaging = !viewingDeleted && (showWhatsApp || showSms || showEmail);

  const handleChannel = (channel: BulkSelectionMessageChannel) => {
    if (channel === "whatsapp" && onWhatsApp && messagingTargets)
      onWhatsApp(messagingTargets.waTargets);
    else if (channel === "sms" && onSms && messagingTargets) onSms(messagingTargets.smsReady);
    else if (channel === "email" && onEmail && messagingTargets)
      onEmail(messagingTargets.emailReady);
  };

  const primaryCountKey = `${i18nNamespace}.selectedCount` as AppTranslationKey;
  const fallbackCountKey = `${i18nNamespace}.trash.selected` as AppTranslationKey;
  const useFallbackCount = !(primaryCountKey in APP_TRANSLATIONS_EN);
  const countLabel =
    (!useFallbackCount ? t(primaryCountKey, { count: selectedCount }) : "") ||
    t(fallbackCountKey, { count: selectedCount });

  const primaryRestoreKey = `${i18nNamespace}.bulkRestore` as AppTranslationKey;
  const fallbackRestoreKey = `${i18nNamespace}.trash.restore` as AppTranslationKey;
  const useFallbackRestore = !(primaryRestoreKey in APP_TRANSLATIONS_EN);
  const restoreLabelFinal =
    restoreLabel ?? ((!useFallbackRestore ? t(primaryRestoreKey) : "") || t(fallbackRestoreKey));

  const statusKey = `${i18nNamespace}.bulkStatus` as AppTranslationKey;

  return (
    <ModuleWorkBulkActionBar
      selectedCount={selectedCount}
      viewingDeleted={viewingDeleted}
      countLabel={countLabel}
      leading={<LeadingIcon className="w-4 h-4 text-primary" aria-hidden="true" />}
      deselectLabel={t("common.deselect")}
      canDelete={canDelete}
      restoreLabel={restoreLabelFinal}
      onRequestBulkRestore={onRequestBulkRestore}
      onClearSelection={onClearSelection}
      deleteAction={
        (!bulkActions || bulkActions.includes("delete")) && canDelete
          ? {
              label: deleteLabel ?? t("common.delete"),
              onClick: onRequestBulkDelete,
            }
          : undefined
      }
      exportAction={
        exportAction
          ? {
              label: exportAction.label,
              onClick: exportAction.onClick,
              isPending: exportAction.isPending,
            }
          : bulkActions?.includes("export") && canExport && onBulkExport
            ? {
                label: exportLabel ?? t(`${i18nNamespace}.bulkExport` as AppTranslationKey),
                onClick: onBulkExport,
              }
            : undefined
      }
      messaging={
        showMessaging
          ? {
              onChannel: handleChannel,
              labels: {
                whatsapp: t("messaging.channel.whatsapp"),
                sms: t("messaging.channel.sms"),
                email: t("messaging.channel.email"),
              },
              channels: {
                whatsapp: showWhatsApp,
                sms: showSms,
                email: showEmail,
              },
            }
          : undefined
      }
      extraActions={
        <>
          {!viewingDeleted &&
          bulkActions?.includes("status") &&
          canWrite &&
          onBulkStatusChange &&
          statusConfig ? (
            <BulkSelectionStatusAction
              label={t(statusKey)}
              statuses={Object.keys(statusConfig)}
              statusBadgeConfig={statusConfig}
              disabled={statusPending}
              onSelectStatus={onBulkStatusChange}
            />
          ) : null}
          {extraActions}
        </>
      }
    />
  );
}
