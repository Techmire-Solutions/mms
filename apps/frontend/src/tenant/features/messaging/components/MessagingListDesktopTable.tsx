import React from "react";
import { RotateCcw } from "lucide-react";
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
}: MessagingListDesktopTableProps): React.JSX.Element {
  const { t } = useTranslation();

  const columns = useMessagingTableColumns({
    isColumnVisible,
    logStatusConfig,
    getRecipientName,
    onFilterContact,
  });

  const selectedCount = Object.keys(selectedIds).length;
  const pageCountLabel = formatDirectoryPageCountLabel(logs.length, t, {
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
        if (log.id === focusedLogId) return `ring-2 ring-primary/60 ring-inset ${MESSAGING_KB_FOCUS_CLASS}`;
        return log.status === "failed"
          ? `${SEMANTIC_BG.destructive} hover:bg-destructive/10 border-s-2 border-s-destructive`
          : undefined;
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
      renderRowActions={
        canWrite
          ? (log) => (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onResendLog(log)}
                className={`text-xs font-semibold ${SEMANTIC_TEXT.primary} hover:bg-primary/10`}
              >
                <RotateCcw className="me-1 h-3.5 w-3.5" />
                {t("messaging.resend")}
              </Button>
            )
          : undefined
      }
      actionsLabel={t("common.actions")}
      footerCount={{
        selectedCountLabel: t("messaging.selectedCount", { count: selectedCount }),
        pageCountLabel,
      }}
    />
  );
}
