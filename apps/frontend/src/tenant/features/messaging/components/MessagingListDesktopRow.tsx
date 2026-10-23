import type React from "react";
import { AlertCircle, Check, Copy, Filter, RotateCcw } from "lucide-react";
import {
  calculateSmsSegments,
  formatDateTime,
  getInitials,
  getMessageCategoryLabelKey,
  type Message,
} from "@mms/shared";
import { Button } from "@/components/ui/button";
import { ChannelBadge } from "@/components/app/ChannelBadge";
import { ModuleTableSelectionCell } from "@/components/app/ModuleTableSelectionCell";
import { StatusBadge, type StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import { TableCell, TableRow } from "@/components/ui/table";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { SEMANTIC_TEXT, SEMANTIC_BG } from "@/lib/ui/semanticTone";

export interface MessagingListDesktopRowProps {
  log: Message;
  isSelected: boolean;
  name: string;
  isCopied: boolean;
  canWrite: boolean;
  logStatusConfig: Record<string, StatusBadgeConfigItem>;
  showRecipient: boolean;
  showChannel: boolean;
  showBody: boolean;
  showDateSent: boolean;
  onToggleLog: (log: Message, shiftKey?: boolean) => void;
  onResendLog: (log: Message) => void;
  onViewLog?: (log: Message) => void;
  onFilterContact?: (name: string) => void;
  onCopyBody: (e: React.MouseEvent, log: Message) => void;
}

export function MessagingListDesktopRow({
  log,
  isSelected,
  name,
  isCopied,
  canWrite,
  logStatusConfig,
  showRecipient,
  showChannel,
  showBody,
  showDateSent,
  onToggleLog,
  onResendLog,
  onViewLog,
  onFilterContact,
  onCopyBody,
}: MessagingListDesktopRowProps): React.JSX.Element {
  const { t } = useTranslation();
  const isFailed = log.status === "failed";
  const smsSegments = showChannel && log.channel === "sms" ? calculateSmsSegments(log.body) : null;
  const categoryKey = log.category ? getMessageCategoryLabelKey(log.category) : null;
  const isFallbackName = name.startsWith("Contact #") || name === String(log.contactId);

  return (
    <TableRow
      tabIndex={0}
      className={cn(
        "transition-colors cursor-pointer group focus-visible:outline-hidden focus-visible:bg-muted/40",
        isFailed
          ? `${SEMANTIC_BG.destructive} hover:bg-destructive/10 border-s-2 border-s-destructive`
          : "hover:bg-muted/20",
      )}
      onClick={() => onViewLog?.(log)}
    >
      <ModuleTableSelectionCell
        checked={isSelected}
        onCheckedChange={() => {}}
        ariaLabel={t("messaging.selectRecipient", { name })}
        sticky={false}
        stopPropagation={true}
        onClick={(e) => onToggleLog(log, (e.nativeEvent as MouseEvent).shiftKey)}
        className="px-3 py-2.5"
      />
      {showRecipient && (
        <TableCell className="px-3 py-2.5 font-semibold text-foreground">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black",
                  isFallbackName
                    ? "bg-muted text-muted-foreground animate-pulse"
                    : `${SEMANTIC_BG.primary} ${SEMANTIC_TEXT.primary}`,
                )}
              >
                {isFallbackName ? null : getInitials(name)}
              </span>
              {isFallbackName ? (
                <span
                  className="inline-block h-4 w-24 animate-pulse rounded bg-muted/60"
                  aria-label={name}
                />
              ) : (
                <span
                  className={cn("truncate transition-colors", `hover:${SEMANTIC_TEXT.primary}`)}
                >
                  {name}
                </span>
              )}
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
                className={`h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:${SEMANTIC_TEXT.primary}`}
                title={t("messaging.selectRecipientsDesc")}
              >
                <Filter className="h-3 w-3" />
              </Button>
            )}
          </div>
        </TableCell>
      )}
      {showChannel && (
        <TableCell className="px-3 py-2.5">
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
        </TableCell>
      )}
      {showBody && (
        <TableCell className="max-w-xs truncate px-3 py-2.5 text-muted-foreground" title={log.body}>
          <div className="flex items-center justify-between gap-2">
            <span className="truncate">
              {log.channel === "email" && log.subject && (
                <strong className="text-foreground font-semibold me-1.5">{log.subject}:</strong>
              )}
              {log.body}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={(e) => void onCopyBody(e, log)}
              className={`h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:${SEMANTIC_TEXT.primary}`}
              title={t("contacts.table.copy")}
            >
              {isCopied ? (
                <Check className={`h-3 w-3 ${SEMANTIC_TEXT.success}`} />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
        </TableCell>
      )}
      {showDateSent && (
        <TableCell className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
          {formatDateTime(log.sentAt)}
        </TableCell>
      )}
      <TableCell className="px-3 py-2.5 text-end" onClick={(e) => e.stopPropagation()}>
        {canWrite && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onResendLog(log)}
            className={`text-xs font-semibold ${SEMANTIC_TEXT.primary} hover:bg-primary/10`}
          >
            <RotateCcw className="me-1 h-3.5 w-3.5" />
            {t("messaging.resend")}
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
