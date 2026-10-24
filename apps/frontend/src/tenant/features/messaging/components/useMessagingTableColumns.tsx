import React, { useMemo } from "react";
import { AlertCircle, Filter } from "lucide-react";
import {
  calculateSmsSegments,
  formatDateTime,
  getInitials,
  getMessageCategoryLabelKey,
  type Message,
} from "@mms/shared";
import { type StatusBadgeConfigItem, StatusBadge } from "@/components/app/StatusBadge";
import { ChannelBadge } from "@/components/app/ChannelBadge";
import { CopyBtn } from "@/components/app/CopyButton";
import { Button } from "@/components/ui/button";
import { type WorkBatchTableColumn } from "@/components/common/work";
import { useTranslation } from "@/hooks/useTranslation";
import { SEMANTIC_TEXT, SEMANTIC_BG } from "@/lib/ui/semanticTone";

export interface UseMessagingTableColumnsOptions {
  isColumnVisible: (key: string) => boolean;
  logStatusConfig: Record<string, StatusBadgeConfigItem>;
  getRecipientName: (contactId: string | number) => string;
  onFilterContact?: (name: string) => void;
}

export function useMessagingTableColumns({
  isColumnVisible,
  logStatusConfig,
  getRecipientName,
  onFilterContact,
}: UseMessagingTableColumnsOptions): WorkBatchTableColumn<Message>[] {
  const { t } = useTranslation();

  const showRecipient = isColumnVisible("recipient");
  const showChannel = isColumnVisible("channel");
  const showBody = isColumnVisible("body");
  const showDateSent = isColumnVisible("dateSent");

  return useMemo<WorkBatchTableColumn<Message>[]>(() => {
    const cols: WorkBatchTableColumn<Message>[] = [];

    if (showRecipient) {
      cols.push({
        id: "recipient",
        label: t("messaging.recipient"),
        cellClassName: "font-semibold text-foreground",
        render: (log) => {
          const name = getRecipientName(log.contactId);
          return (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${SEMANTIC_BG.primary} text-xs font-black ${SEMANTIC_TEXT.primary}`}
                >
                  {getInitials(name)}
                </span>
                <span className="truncate hover:text-primary transition-colors">{name}</span>
              </div>
              {onFilterContact && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFilterContact(name);
                  }}
                  className="h-6 w-6 min-h-6 min-w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary cursor-pointer"
                  title={t("messaging.selectRecipientsDesc")}
                >
                  <Filter className="h-3 w-3" />
                </Button>
              )}
            </div>
          );
        },
      });
    }

    if (showChannel) {
      cols.push({
        id: "channel",
        label: t("messaging.channel"),
        render: (log) => {
          const isFailed = log.status === "failed";
          const smsSegments = log.channel === "sms" ? calculateSmsSegments(log.body) : null;
          const categoryKey = log.category ? getMessageCategoryLabelKey(log.category) : null;
          return (
            <div className="flex items-center gap-1.5 flex-wrap">
              <ChannelBadge channel={log.channel} />
              {categoryKey && (
                <span className="text-2xs px-1.5 py-0.5 bg-muted/60 text-muted-foreground rounded-md font-medium">
                  {t(categoryKey)}
                </span>
              )}
              {smsSegments && (
                <span className="text-2xs font-mono text-muted-foreground bg-muted/60 px-1 py-0.5 rounded-md">
                  {smsSegments.totalSegments} {smsSegments.totalSegments === 1 ? "seg" : "segs"}
                </span>
              )}
              <StatusBadge status={log.status || "sent"} size="sm" config={logStatusConfig} />
              {isFailed && (
                <AlertCircle
                  className={`h-3.5 w-3.5 ${SEMANTIC_TEXT.destructive} shrink-0`}
                  aria-hidden="true"
                />
              )}
            </div>
          );
        },
      });
    }

    if (showBody) {
      cols.push({
        id: "body",
        label: t("messaging.messageBody"),
        cellClassName: "max-w-xs truncate text-muted-foreground",
        render: (log) => {
          return (
            <div className="flex items-center justify-between gap-2" title={log.body}>
              <span className="truncate">
                {log.channel === "email" && log.subject && (
                  <strong className="text-foreground font-semibold me-1.5">{log.subject}:</strong>
                )}
                {log.body}
              </span>
              <CopyBtn
                text={log.body}
                showToast
                className="h-6 w-6 min-h-6 min-w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary shadow-none cursor-pointer"
              />
            </div>
          );
        },
      });
    }

    if (showDateSent) {
      cols.push({
        id: "dateSent",
        label: t("messaging.dateSent"),
        cellClassName: "font-mono text-xs text-muted-foreground",
        render: (log) => formatDateTime(log.sentAt),
      });
    }

    return cols;
  }, [
    getRecipientName,
    logStatusConfig,
    onFilterContact,
    showBody,
    showChannel,
    showDateSent,
    showRecipient,
    t,
  ]);
}
