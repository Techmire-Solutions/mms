import React from "react";
import { Eye, RotateCcw } from "lucide-react";
import type { Message } from "@mms/shared";
import type { StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { WorkBatchTable } from "@/components/common/work";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDirectoryPageCountLabel } from "@/lib/formatDirectoryPageCountLabel";
import { SEMANTIC_TEXT, SEMANTIC_BG } from "@/lib/ui/semanticTone";
import { MESSAGING_KB_FOCUS_CLASS } from "../hooks/useMessagingWorkTierKeyboardNav";
import type { MessagingSelectedLogsMap } from "./MessagingWorkTier";
import { useMessagingTableColumns } from "./useMessagingTableColumns";

export interface MessagingListDesktopTableProps {
  logs: Message[];
  selectedIds: MessagingSelectedLogsMap;
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
  canWrite: boolean;
  logStatusConfig: Record<string, StatusBadgeConfigItem>;
  getRecipientName: (contactId: string | number) => string;
  getColumnWidth: (key: string) => number | undefined;
  isColumnVisible: (key: string) => boolean;
  setColumnWidth: (key: string, width: number) => void;
  /** id of the log targeted by j/k keyboard navigation (for visible focus styling). */
  focusedLogId?: string | null;
  onToggleLog: (log: Message, shiftKey?: boolean) => void;
  onToggleAllVisible: (checked: boolean) => void;
  onResendLog: (log: Message) => void;
  onViewLog?: (log: Message) => void;
  onFilterContact?: (name: string) => void;
  /** Shared footer label from the work-tier controller (cards use the same one). */
  pageCountLabel?: string;
}

export function MessagingListDesktopTable({
  logs,
  selectedIds,
  allVisibleSelected,
  someVisibleSelected,
  canWrite,
  logStatusConfig,
  getRecipientName,
  getColumnWidth,
  isColumnVisible,
  onToggleLog,
  onToggleAllVisible,
  onResendLog,
  onViewLog,
  onFilterContact,
  focusedLogId,
  setColumnWidth,
  pageCountLabel: pageCountLabelProp,
}: MessagingListDesktopTableProps): React.JSX.Element {
  const { t } = useTranslation();

  const columns = useMessagingTableColumns({
    isColumnVisible,
    logStatusConfig,
    getRecipientName,
    onFilterContact,
  });

  const selectedCount = Object.keys(selectedIds).length;
  const pageCountLabel =
    pageCountLabelProp ??
    formatDirectoryPageCountLabel(logs.length, t, {
      singular: "messaging.log",
      plural: "messaging.logs",
    });

  return (
    <WorkBatchTable<Message>
      data={logs}
      columns={columns}
      caption={t("messaging.logs")}
      className="table-fixed text-xs"
      stickyColumnId="recipient"
      onRowClick={onViewLog}
      rowClassName={(log) => {
        const classes = [
          log.id === focusedLogId
            ? `ring-2 ring-primary/60 ring-inset ${MESSAGING_KB_FOCUS_CLASS}`
            : "",
          // Archived rows look different from active ones: the toggle alone is
          // easy to miss once the list scrolls.
          log.deletedAt ? "opacity-70" : "",
          log.status === "failed"
            ? `${SEMANTIC_BG.destructive} hover:bg-destructive/10 border-s-2 border-s-destructive`
            : "",
        ].filter(Boolean);
        return classes.length > 0 ? classes.join(" ") : undefined;
      }}
      selection={{
        selectedIds: Object.keys(selectedIds),
        onSelectOne: (id: string) => {
          const found = logs.find((l) => String(l.id) === id);
          if (found) onToggleLog(found);
        },
        onSelectAll: () => onToggleAllVisible(!allVisibleSelected),
        allSelected: allVisibleSelected,
        someSelected: someVisibleSelected,
        selectAllAriaLabel: t("messaging.selectAllVisible"),
        selectRowAriaLabel: (log) =>
          t("messaging.selectRecipient", { name: getRecipientName(log.contactId) }),
      }}
      columnResize={{
        getColumnWidth,
        onColumnResize: setColumnWidth,
      }}
      renderRowActions={(log) => (
        <div className="flex items-center justify-end gap-0.5">
          {/* The row itself cannot be a button (selection + actions make it a
              nested-interactive target), so the drawer needs this real control
              for keyboard and screen-reader users. */}
          {onViewLog ? (
            <Button
              variant="ghost"
              size="icon"
              className="min-h-11 min-w-11 text-muted-foreground hover:text-primary"
              title={t("common.details")}
              aria-label={t("messaging.viewLogAria", {
                name: getRecipientName(log.contactId),
              })}
              onClick={(e) => {
                e.stopPropagation();
                onViewLog(log);
              }}
            >
              <Eye className="h-4 w-4" aria-hidden="true" />
            </Button>
          ) : null}
          {canWrite ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onResendLog(log);
              }}
              className={`text-xs font-semibold ${SEMANTIC_TEXT.primary} hover:bg-primary/10`}
            >
              <RotateCcw className="me-1 h-3.5 w-3.5" aria-hidden="true" />
              {t("messaging.resend")}
            </Button>
          ) : null}
        </div>
      )}
      actionsCellClassName="w-24 min-w-24 px-2 py-3"
      actionsLabel={t("common.actions")}
      footerCount={{
        selectedCountLabel: t("messaging.selectedCount", { count: selectedCount }),
        pageCountLabel,
      }}
    />
  );
}
