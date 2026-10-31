import React, { useCallback, useEffect, useState, type JSX } from "react";
import {
  formatDateTime,
  type Message,
  type StandardMessagingRecipient as MessagingRecipient,
} from "@mms/shared";
import { ChannelBadge } from "@/components/app/ChannelBadge";
import { DetailDrawerShell } from "@/components/app/DetailDrawerShell";
import { StatusBadge, type StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { SEMANTIC_TEXT, SEMANTIC_BG } from "@/lib/ui/semanticTone";
import { AlertCircle, ArrowUpRight, MessageSquare, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";
import { PersonDetailHeroCard } from "@/components/app/PersonDetailHeroCard";
import { EntityMessagingQuickActions } from "@/components/app/EntityMessagingActions";
import { DetailDrawerArchivedBanner } from "@/components/app/DetailDrawerArchiveChrome";
import { DrawerUpdatedStamp } from "@/components/app/DrawerUpdatedStamp";
import { CopyBtn } from "@/components/app/CopyButton";
import { MessagingDetailBodyCard } from "./MessagingDetailBodyCard";
import { MessagingDetailMetadataCard } from "./MessagingDetailMetadataCard";

export interface MessagingDetailProps {
  log: Message | null;
  recipient?: MessagingRecipient | null;
  logStatusConfig: Record<string, StatusBadgeConfigItem>;
  canWrite: boolean;
  canRestoreLogs?: boolean;
  onRestoreLog?: (log: Message) => Promise<void>;
  onClose: () => void;
  onResend: (log: Message) => void;
}

export const MessagingDetail = function MessagingDetail({
  log,
  recipient,
  logStatusConfig,
  canWrite,
  canRestoreLogs,
  onRestoreLog,
  onClose,
  onResend,
}: MessagingDetailProps): JSX.Element | null {
  const { t } = useTranslation();
  const [restoring, setRestoring] = useState(false);

  const handleRestore = useCallback(async (): Promise<void> => {
    if (!log || restoring || !onRestoreLog) return;
    setRestoring(true);
    try {
      await onRestoreLog(log);
      onClose();
    } finally {
      setRestoring(false);
    }
  }, [log, restoring, onRestoreLog, onClose]);

  const handleResend = useCallback((): void => {
    if (!log || !canWrite) return;
    onClose();
    onResend(log);
  }, [log, canWrite, onClose, onResend]);

  // Keyboard shortcut: Cmd/Ctrl + Enter to trigger Resend
  useEffect(() => {
    if (!log || !canWrite) return;
    const handleKeyDown = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleResend();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [log, canWrite, handleResend]);

  if (!log) return null;

  const recipientName = recipient?.name || t("messaging.contactFallback", { id: log.contactId });
  const isFailed = log.status === "failed";
  const isSkipped = log.status === "skipped";
  const cleanPhone = recipient?.phone ? recipient.phone.replace(/[^0-9]/g, "") : "";

  return (
    <DetailDrawerShell
      open={Boolean(log)}
      onClose={onClose}
      title={recipientName}
      subtitle={formatDateTime(log.sentAt)}
      icon={MessageSquare}
      size="md"
      archiveBanner={
        log.deletedAt ? <DetailDrawerArchivedBanner deletedAt={log.deletedAt} /> : undefined
      }
      footer={
        <div className="flex w-full flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-3xs text-muted-foreground font-mono">
              <span>#{String(log.id).slice(0, 10)}</span>
              <CopyBtn
                text={String(log.id)}
                showToast
                className="h-6 w-6 min-h-6 min-w-6 rounded-md shadow-none cursor-pointer"
              />
            </div>
            <DrawerUpdatedStamp createdAt={log.sentAt} label={t("messaging.dateSent")} />
          </div>
          <div className="flex items-center gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="cursor-pointer min-h-11 px-3"
            >
              {t("common.close")}
            </Button>
            {log.deletedAt && canRestoreLogs && onRestoreLog ? (
              <Button
                variant="default"
                size="sm"
                onClick={() => void handleRestore()}
                disabled={restoring}
                loading={restoring}
                className="gap-1.5 min-h-11 px-3"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {t("messaging.restoreLog")}
              </Button>
            ) : (
              canWrite && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleResend}
                  className="gap-1.5 min-h-11 px-3"
                  title={`${t("messaging.resend")} (⌘+Enter)`}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {t("messaging.resend")}
                </Button>
              )
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Diagnostics & Failure Reason Notice */}
        {(isFailed || isSkipped) && (
          <div
            className={`p-3 rounded-lg border border-destructive/30 ${SEMANTIC_BG.destructive} ${SEMANTIC_TEXT.destructive} space-y-1`}
          >
            <div className="flex items-center gap-1.5 font-semibold">
              <AlertCircle className="h-4 w-4" />
              <span>{isFailed ? t("messaging.status.failed") : t("messaging.status.skipped")}</span>
            </div>
            <p className={`text-xs ${SEMANTIC_TEXT.destructive} opacity-90`}>
              {isFailed
                ? t("messaging.loadFailedHint")
                : t("messaging.skippedNotice", { count: 1, type: t("messaging.phoneNumber") })}
            </p>
            {canWrite && isFailed && (
              <div className="pt-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={handleResend}
                  className="gap-1.5 min-h-11 px-3 text-xs font-semibold"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {t("messaging.resend")}
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="space-y-4">
          <PersonDetailHeroCard
            id={log.contactId || ""}
            displayName={recipientName}
            avatar={null}
            accentColor="primary"
          >
            <ChannelBadge channel={log.channel} />
            <StatusBadge status={log.status || "sent"} size="sm" config={logStatusConfig} />
          </PersonDetailHeroCard>

          <div className="flex items-center justify-between px-1">
            <span className="text-muted-foreground font-mono text-xs">
              {recipient?.phone ||
                recipient?.email ||
                t("messaging.contactFallback", { id: log.contactId })}
            </span>
            {log.contactId && (
              <Link
                to={`/contacts?contactId=${log.contactId}`}
                className={`inline-flex items-center gap-1 ${SEMANTIC_TEXT.primary} hover:underline font-semibold shrink-0 text-xs w-max`}
              >
                <span>{t("contacts.table.viewProfile")}</span>
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            )}
          </div>

          <EntityMessagingQuickActions
            primaryPhone={cleanPhone || recipient?.phone}
            primaryEmail={recipient?.email}
            labels={{
              call: t("common.call"),
              whatsapp: t("messaging.channel.whatsapp"),
              sms: t("messaging.channel.sms"),
              email: t("common.emailAction"),
            }}
          />
        </div>

        <MessagingDetailBodyCard log={log} />
        <MessagingDetailMetadataCard log={log} />
      </div>
    </DetailDrawerShell>
  );
};
