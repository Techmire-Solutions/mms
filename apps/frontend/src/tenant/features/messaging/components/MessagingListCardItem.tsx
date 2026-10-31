import type React from "react";
import { AlertCircle } from "lucide-react";
import {
  calculateSmsSegments,
  formatDateTime,
  getMessageCategoryLabelKey,
  type Message,
} from "@mms/shared";
import { ChannelBadge } from "@/components/app/ChannelBadge";
import { CopyBtn } from "@/components/app/CopyButton";
import { DirectoryEntityCard } from "@/components/app/DirectoryEntityCard";
import { EntityCard } from "@/components/app/EntityCard";
import { DirectoryCardMetaTile } from "@/components/app/DirectoryCardMetaTile";
import { StatusBadge, type StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { SEMANTIC_TEXT } from "@/lib/ui/semanticTone";

import { getMessagingChannelAccentBarClass } from "../lib/messagingCardTokens";
import { MESSAGING_KB_FOCUS_CLASS } from "../hooks/useMessagingWorkTierKeyboardNav";
import { MessagingListCardActions } from "./MessagingListCardActions";

export { getMessagingChannelAccentBarClass };

export interface MessagingListCardItemProps {
  log: Message;
  isSelected: boolean;
  name: string;
  isCopied?: boolean;
  canWrite: boolean;
  reducedMotion: boolean;
  logStatusConfig: Record<string, StatusBadgeConfigItem>;
  isColumnVisible: (key: string) => boolean;
  /** While true, the j/k keyboard navigation targets this card (focus ring). */
  isKeyboardFocused?: boolean;
  onToggleLog: (log: Message, shiftKey?: boolean) => void;
  onResendLog: (log: Message) => void;
  onViewLog?: (log: Message) => void;
  onFilterContact?: (name: string) => void;
  onCopyBody?: (e: React.MouseEvent, log: Message) => void;
}

/** Work directory card — DirectoryEntityCard SSOT (do not hand-compose EntityCard). */
export function MessagingListCardItem({
  log,
  isSelected,
  name,
  canWrite,
  reducedMotion,
  logStatusConfig,
  isColumnVisible,
  isKeyboardFocused,
  onToggleLog,
  onResendLog,
  onViewLog,
  onFilterContact,
}: MessagingListCardItemProps): React.JSX.Element {
  const { t } = useTranslation();
  const isFailed = log.status === "failed";
  const isSms = log.channel === "sms";
  const smsSegments = isSms ? calculateSmsSegments(log.body) : null;
  const categoryKey = log.category ? getMessageCategoryLabelKey(log.category) : null;

  return (
    <DirectoryEntityCard
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
        isKeyboardFocused && `ring-2 ring-primary/60 ${MESSAGING_KB_FOCUS_CLASS}`,
      )}
      header={{
        displayName: name,
        subtitle: (
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            {isColumnVisible("dateSent") && (
              <time
                dateTime={new Date(log.sentAt).toISOString()}
                className="text-xs font-mono text-muted-foreground"
              >
                {formatDateTime(log.sentAt)}
              </time>
            )}
            {categoryKey && (
              <span className="text-2xs px-1.5 py-0.5 bg-muted/60 text-muted-foreground rounded-md font-medium">
                {t(categoryKey)}
              </span>
            )}
          </div>
        ),
      }}
      viewLabel={t("common.details")}
      viewAriaLabel={t("messaging.viewLogAria", { name })}
      metadataSlot={
        <EntityCard.MetaGrid>
          {isColumnVisible("channel") && (
            <DirectoryCardMetaTile label={t("messaging.channel")}>
              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                <ChannelBadge channel={log.channel} />
                {smsSegments && (
                  <span className="text-2xs font-mono text-muted-foreground bg-muted/60 px-1 py-0.5 rounded-md">
                    {t("messaging.smsSegmentBadge", { count: smsSegments.totalSegments })}
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
            </DirectoryCardMetaTile>
          )}

          {isColumnVisible("body") && (
            <DirectoryCardMetaTile label={t("messaging.messageBody")} className="sm:col-span-2">
              <div className="flex items-start justify-between gap-2 mt-0.5">
                <div className="min-w-0 flex-1">
                  {log.channel === "email" && log.subject && (
                    <p title={log.subject} className="font-semibold text-foreground mb-1 truncate">
                      {log.subject}
                    </p>
                  )}
                  <p className="line-clamp-2 leading-relaxed whitespace-pre-wrap">{log.body}</p>
                </div>
                <CopyBtn
                  text={log.body}
                  showToast
                  className="min-h-11 min-w-11 shrink-0 text-muted-foreground hover:text-primary shadow-none cursor-pointer"
                />
              </div>
            </DirectoryCardMetaTile>
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
