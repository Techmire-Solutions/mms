import type React from "react";
import { AlertCircle, Check, Copy } from "lucide-react";
import {
  calculateSmsSegments,
  formatDateTime,
  getMessageCategoryLabelKey,
  type Message,
} from "@mms/shared";
import { Button } from "@/components/ui/button";
import { ChannelBadge } from "@/components/app/ChannelBadge";
import { DirectoryCard } from "@/components/app/DirectoryCard";
import { EntityCard } from "@/components/app/EntityCard";
import { EntityCardMetaTile } from "@/components/app/EntityCardMetaTile";
import { StatusBadge, type StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { SEMANTIC_TEXT } from "@/lib/ui/semanticTone";

import { getMessagingChannelAccentBarClass } from "../lib/messagingCardTokens";
import { MessagingListCardActions } from "./MessagingListCardActions";

export { getMessagingChannelAccentBarClass };

export interface MessagingListCardItemProps {
  log: Message;
  isSelected: boolean;
  name: string;
  isCopied: boolean;
  canWrite: boolean;
  reducedMotion: boolean;
  logStatusConfig: Record<string, StatusBadgeConfigItem>;
  isColumnVisible: (key: string) => boolean;
  onToggleLog: (log: Message, shiftKey?: boolean) => void;
  onResendLog: (log: Message) => void;
  onViewLog?: (log: Message) => void;
  onFilterContact?: (name: string) => void;
  onCopyBody: (e: React.MouseEvent, log: Message) => void;
}

/** Work directory card — DirectoryCard SSOT (do not hand-compose EntityCard). */
export function MessagingListCardItem({
  log,
  isSelected,
  name,
  isCopied,
  canWrite,
  reducedMotion,
  logStatusConfig,
  isColumnVisible,
  onToggleLog,
  onResendLog,
  onViewLog,
  onFilterContact,
  onCopyBody,
}: MessagingListCardItemProps): React.JSX.Element {
  const { t } = useTranslation();
  const isFailed = log.status === "failed";
  const isSms = log.channel === "sms";
  const smsSegments = isSms ? calculateSmsSegments(log.body) : null;
  const categoryKey = log.category ? getMessageCategoryLabelKey(log.category) : null;

  return (
    <DirectoryCard
      entity={log}
      selectedIds={isSelected ? [log.id] : []}
      canSelect
      onToggleSelected={() => onToggleLog(log)}
      onView={onViewLog}
      reducedMotion={reducedMotion}
      accentClassName={getMessagingChannelAccentBarClass(isSelected, log.channel)}
      className={cn(
        "transition-all group",
        isFailed && `border-destructive/30 ${SEMANTIC_TEXT.destructive}`,
      )}
      header={{
        displayName: name,
        subtitle: (
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            {isColumnVisible("dateSent") && (
              <p className="text-xs font-mono text-muted-foreground">
                {formatDateTime(log.sentAt)}
              </p>
            )}
            {categoryKey && (
              <span className="text-2xs px-1.5 py-0.5 bg-muted/60 text-muted-foreground rounded-md font-medium">
                {t(categoryKey)}
              </span>
            )}
          </div>
        ),
      }}
      viewLabel={t("contacts.actionViewShort")}
      viewAriaLabel={`${t("contacts.table.viewProfile")} - ${name}`}
      metadataSlot={
        <EntityCard.MetaGrid>
          {isColumnVisible("channel") && (
            <EntityCardMetaTile label={t("messaging.channel")}>
              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                <ChannelBadge channel={log.channel} />
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
            </EntityCardMetaTile>
          )}

          {isColumnVisible("body") && (
            <EntityCardMetaTile label={t("messaging.messageBody")} className="sm:col-span-2">
              <div className="flex items-start justify-between gap-2 mt-0.5">
                <div className="min-w-0 flex-1">
                  {log.channel === "email" && log.subject && (
                    <p title={log.subject} className="font-semibold text-foreground mb-1 truncate">
                      {log.subject}
                    </p>
                  )}
                  <p className="line-clamp-2 leading-relaxed whitespace-pre-wrap">{log.body}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={(e) => void onCopyBody(e, log)}
                  className={`min-h-11 min-w-11 shrink-0 text-muted-foreground hover:${SEMANTIC_TEXT.primary}`}
                  title={t("contacts.table.copy")}
                >
                  {isCopied ? (
                    <Check className={`h-3 w-3 ${SEMANTIC_TEXT.success}`} />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </EntityCardMetaTile>
          )}
        </EntityCard.MetaGrid>
      }
      banner={
        isFailed ? (
          <div
            className={`flex items-center gap-1.5 text-3xs font-medium ${SEMANTIC_TEXT.destructive}`}
          >
            <AlertCircle className="h-3 w-3 shrink-0" />
            <span className="truncate">{t("messaging.loadFailedHint")}</span>
          </div>
        ) : null
      }
      actions={
        <MessagingListCardActions
          log={log}
          name={name}
          canWrite={canWrite}
          onResendLog={onResendLog}
          onFilterContact={onFilterContact}
        />
      }
    />
  );
}
