import { type JSX } from "react";
import { ChevronDown, MessageSquare, RotateCcw } from "lucide-react";
import type { AppTranslationKey } from "@mms/shared";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BulkSelectionBar } from "@/components/app/BulkSelectionBar";
import { useTranslation } from "@/hooks/useTranslation";
import { SEMANTIC_TEXT } from "@/lib/ui/semanticTone";
import { MESSAGING_CHANNEL_CONFIG } from "../config";

export interface MessagingWorkBulkActionBarProps {
  selectedCount: number;
  canWrite: boolean;
  canClearLogs: boolean;
  /** Archived view: the same bar restores instead of archiving. */
  viewingDeleted?: boolean;
  canRestoreLogs?: boolean;
  onBulkRestoreRequest?: () => void;
  onClearSelection: () => void;
  onBulkExport?: () => void;
  onBulkResend?: (targetChannel?: "whatsapp" | "sms" | "email") => void;
  onClearLogsRequest?: () => void;
}

export const MessagingWorkBulkActionBar = function MessagingWorkBulkActionBar({
  selectedCount,
  canWrite,
  canClearLogs,
  viewingDeleted = false,
  canRestoreLogs = false,
  onBulkRestoreRequest,
  onClearSelection,
  onBulkExport,
  onBulkResend,
  onClearLogsRequest,
}: MessagingWorkBulkActionBarProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <BulkSelectionBar
      selectedCount={selectedCount}
      viewingDeleted={viewingDeleted}
      canWrite={canWrite}
      canDelete={
        viewingDeleted
          ? canRestoreLogs && Boolean(onBulkRestoreRequest)
          : canClearLogs && Boolean(onClearLogsRequest)
      }
      // Archived logs are exported through the active-view query, so the export
      // action stays out of the archived bar instead of exporting the wrong set.
      canExport={!viewingDeleted && Boolean(onBulkExport)}
      leadingIcon={MessageSquare}
      i18nNamespace="messaging"
      bulkActions={["export", "delete"]}
      onClearSelection={onClearSelection}
      onRequestBulkDelete={() => onClearLogsRequest?.()}
      onRequestBulkRestore={() => onBulkRestoreRequest?.()}
      deleteLabel={t("messaging.clearLogs")}
      restoreLabel={t("messaging.restoreLog")}
      exportAction={
        !viewingDeleted && canWrite && onBulkExport
          ? {
              // The export runs the active filters, not the selection — a
              // "(N selected)" label would promise something different.
              label: t("messaging.exportLogsFiltered"),
              onClick: onBulkExport,
            }
          : undefined
      }
      extraActions={
        canWrite && onBulkResend ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={`min-h-11 gap-1.5 px-3 font-semibold text-xs ${SEMANTIC_TEXT.primary} border-primary/30 hover:bg-primary/10`}
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden />
                <span>{t("messaging.resend")}</span>
                <ChevronDown className="w-3 h-3 opacity-70" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem
                onClick={() => onBulkResend()}
                className="cursor-pointer gap-2 py-2 text-xs font-medium"
              >
                <RotateCcw className={`h-3.5 w-3.5 ${SEMANTIC_TEXT.primary}`} />
                <span>{t("messaging.resend")}</span>
              </DropdownMenuItem>
              {Object.values(MESSAGING_CHANNEL_CONFIG).map((config) => {
                const Icon = config.icon;
                return (
                  <DropdownMenuItem
                    key={config.id}
                    onClick={() => onBulkResend(config.id as "whatsapp" | "sms" | "email")}
                    className="cursor-pointer gap-2 py-2 text-xs font-medium"
                  >
                    <Icon
                      className={`h-3.5 w-3.5 ${SEMANTIC_TEXT[config.themeAccent as keyof typeof SEMANTIC_TEXT]}`}
                    />
                    <span>{t(`messaging.channel.${config.id}` as AppTranslationKey)}</span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : undefined
      }
    />
  );
};
