import React, { useCallback, useEffect, useState, type JSX } from "react";
import {
  formatDateTime,
  type Message,
  type StandardMessagingRecipient as MessagingRecipient,
} from "@mms/shared";
import { ChannelBadge } from "@/components/app/ChannelBadge";
import { Drawer } from "@/components/app/Drawer";
import { StatusBadge, type StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import { SEMANTIC_TEXT, SEMANTIC_BG } from "@/lib/ui/semanticTone";
import { AlertCircle, ArrowUpRight, Check, Copy, MessageSquare, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";
import { PersonDetailHeroCard } from "@/components/app/PersonDetailHeroCard";
import { EntityMessagingActions } from "@/components/app/EntityMessagingActions";
import { MessagingDetailBodyCard } from "./MessagingDetailBodyCard";
import { MessagingDetailMetadataCard } from "./MessagingDetailMetadataCard";

export interface MessagingDetailProps {
  log: Message | null;
  recipient?: MessagingRecipient | null;
  logStatusConfig: Record<string, StatusBadgeConfigItem>;
  canWrite: boolean;
  onClose: () => void;
  onResend: (log: Message) => void;
}

export const MessagingDetail = function MessagingDetail({
  log,
  recipient,
  logStatusConfig,
  canWrite,
  onClose,
  onResend,
}: MessagingDetailProps): JSX.Element | null {
  const { t } = useTranslation();
  const [copiedId, setCopiedId] = useState(false);

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

  const copyIdToClipboard = async (text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
      notify.success(t("contacts.table.copied"));
    } catch {
      notify.error(t("messaging.loadFailedHint"));
    }
  };

  return (
    <Drawer
      open={Boolean(log)}
      onClose={onClose}
      title={recipientName}
      subtitle={formatDateTime(log.sentAt)}
      icon={MessageSquare}
      size="md"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-3xs text-muted-foreground font-mono">
            <span>#{String(log.id).slice(0, 10)}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 touch-target-coarse text-muted-foreground hover:text-foreground"
              onClick={() => void copyIdToClipboard(String(log.id))}
              aria-label={t("contacts.table.copied")}
            >
              {copiedId ? (
                <Check className={`h-3 w-3 ${SEMANTIC_TEXT.success}`} />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              {t("common.close")}
            </Button>
            {canWrite && (
              <Button
                variant="default"
                size="sm"
                onClick={handleResend}
                className="gap-1.5"
                title={`${t("messaging.resend")} (⌘+Enter)`}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {t("messaging.resend")}
              </Button>
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

          <EntityMessagingActions
            variant="button-group"
            primaryPhone={cleanPhone}
            primaryEmail={recipient?.email}
            labels={{
              call: t("contacts.detail.call"),
              whatsapp: t("contacts.whatsapp"),
              sms: t("contacts.sms"),
              email: t("contacts.detail.emailAction"),
            }}
            onWhatsApp={
              cleanPhone ? () => window.open(`https://wa.me/${cleanPhone}`, "_blank") : undefined
            }
            onSms={
              cleanPhone
                ? () => {
                    window.location.href = `sms:${cleanPhone}`;
                  }
                : undefined
            }
            onEmail={
              recipient?.email
                ? () => {
                    window.location.href = `mailto:${recipient?.email}?subject=${encodeURIComponent(log.subject || "")}`;
                  }
                : undefined
            }
          />
        </div>

        <MessagingDetailBodyCard log={log} />
        <MessagingDetailMetadataCard log={log} />
      </div>
    </Drawer>
  );
};
