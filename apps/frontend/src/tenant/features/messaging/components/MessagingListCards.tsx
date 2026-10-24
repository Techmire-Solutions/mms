import React, { useState } from "react";
import type { Message } from "@mms/shared";
import { EntityCardsGrid } from "@/components/app/EntityCardsGrid";
import { type StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import { notify } from "@/lib/notify";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useTranslation } from "@/hooks/useTranslation";
import { MessagingListCardItem } from "./MessagingListCardItem";
import { type MessagingSelectedLogsMap } from "./MessagingWorkTier";

export interface MessagingListCardsProps {
  logs: Message[];
  selectedIds: MessagingSelectedLogsMap;
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
  selectedCount: number;
  selectedCountLabel: React.ReactNode;
  pageCountLabel: React.ReactNode;
  canWrite: boolean;
  logStatusConfig: Record<string, StatusBadgeConfigItem>;
  getRecipientName: (contactId: string | number) => string;
  isColumnVisible: (key: string) => boolean;
  onToggleLog: (log: Message, shiftKey?: boolean) => void;
  onToggleAllVisible: (checked: boolean) => void;
  onResendLog: (log: Message) => void;
  onViewLog?: (log: Message) => void;
  onFilterContact?: (name: string) => void;
}

export const MessagingListCards = function MessagingListCards({
  logs,
  selectedIds,
  allVisibleSelected,
  someVisibleSelected,
  selectedCount: _selectedCount,
  selectedCountLabel,
  pageCountLabel,
  canWrite,
  logStatusConfig,
  getRecipientName,
  isColumnVisible,
  onToggleLog,
  onToggleAllVisible,
  onResendLog,
  onViewLog,
  onFilterContact,
}: MessagingListCardsProps): React.JSX.Element {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);

  const handleCopyBody = async (e: React.MouseEvent, log: Message): Promise<void> => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(log.body);
      setCopiedLogId(String(log.id));
      notify.success(t("contacts.table.copied"));
      setTimeout(() => setCopiedLogId(null), 2000);
    } catch {
      notify.error(t("messaging.loadFailedHint"));
    }
  };

  const selectedIdsArray = Object.keys(selectedIds).filter((k) => selectedIds[k]);

  return (
    <div className="space-y-3">
      <EntityCardsGrid
        items={logs}
        selectedIds={selectedIdsArray}
        onSelectAll={() => onToggleAllVisible(!allVisibleSelected)}
        allSelected={allVisibleSelected}
        someSelected={someVisibleSelected}
        selectAllLabel={t("messaging.selectAllVisible")}
        deselectAllLabel={t("common.deselect")}
        selectedCountLabel={selectedCountLabel as string}
        pageCountLabel={pageCountLabel as string}
        checkboxIdPrefix="messaging-cards"
        renderItem={(log) => (
          <MessagingListCardItem
            key={log.id}
            log={log}
            isSelected={Boolean(selectedIds[String(log.id)])}
            name={getRecipientName(log.contactId)}
            isCopied={copiedLogId === String(log.id)}
            canWrite={canWrite}
            reducedMotion={reducedMotion}
            logStatusConfig={logStatusConfig}
            isColumnVisible={isColumnVisible}
            onToggleLog={onToggleLog}
            onResendLog={onResendLog}
            onViewLog={onViewLog}
            onFilterContact={onFilterContact}
            onCopyBody={handleCopyBody}
          />
        )}
      />
    </div>
  );
};
