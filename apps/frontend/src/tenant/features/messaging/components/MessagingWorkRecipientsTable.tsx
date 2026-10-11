import React, { type JSX, type ReactNode, useMemo } from "react";
import {
  getDisplayName,
  getInitials,
  getPrimaryEmail,
  getPrimaryPhone,
  type Contact,
} from "@mms/shared";
import { WorkBatchTable, type WorkBatchTableColumn } from "@/components/common/work";
import { useTranslation } from "@/hooks/useTranslation";
import type { MessagingSelectedMap } from "@/tenant/features/messaging/components/messagingWorkPanelShared";
import { SEMANTIC_TEXT, SEMANTIC_BG } from "@/lib/semanticTone";
import { MissingFieldBadge } from "./messagingRecipientsShared";

export interface MessagingWorkRecipientsTableProps {
  contacts: Contact[];
  selectedById: MessagingSelectedMap;
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
  selectedCount: number;
  selectedCountLabel: ReactNode;
  pageCountLabel: ReactNode;
  showRecipientCol: boolean;
  showPhoneCol: boolean;
  showEmailCol: boolean;
  getColumnWidth: (key: string) => number | undefined;
  setColumnWidth: (key: string, width: number) => void;
  onToggleRecipient: (contact: Contact) => void;
  onToggleAllVisible: (checked: boolean) => void;
}

export function MessagingWorkRecipientsTable({
  contacts,
  selectedById,
  allVisibleSelected,
  someVisibleSelected,
  selectedCount,
  selectedCountLabel,
  pageCountLabel,
  showRecipientCol,
  showPhoneCol,
  showEmailCol,
  getColumnWidth,
  setColumnWidth,
  onToggleRecipient,
  onToggleAllVisible,
}: MessagingWorkRecipientsTableProps): JSX.Element {
  const { t } = useTranslation();

  const selectedIdsArray = useMemo(
    () => Object.keys(selectedById).filter((id) => selectedById[id]),
    [selectedById],
  );

  const columns = useMemo<WorkBatchTableColumn<Contact>[]>(() => {
    const cols: WorkBatchTableColumn<Contact>[] = [];

    if (showRecipientCol) {
      cols.push({
        id: "recipient",
        label: t("messaging.recipient"),
        cellClassName: "px-4 py-2 font-medium text-foreground",
        render: (contact: Contact) => {
          const displayName = getDisplayName(contact);
          return (
            <div className="flex items-center gap-2">
              <span
                className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${SEMANTIC_BG.primary} text-xs font-black ${SEMANTIC_TEXT.primary}`}
              >
                {getInitials(displayName)}
              </span>
              <span className="truncate">{displayName}</span>
            </div>
          );
        },
      });
    }

    if (showPhoneCol) {
      cols.push({
        id: "phone",
        label: t("contacts.form.primaryPhone"),
        cellClassName: "px-4 py-2 font-mono",
        render: (contact: Contact) => {
          const phone = getPrimaryPhone(contact);
          return phone ?? <MissingFieldBadge label={t("messaging.missingPhone")} />;
        },
      });
    }

    if (showEmailCol) {
      cols.push({
        id: "email",
        label: t("contacts.form.primaryEmail"),
        cellClassName: "px-4 py-2",
        render: (contact: Contact) => {
          const email = getPrimaryEmail(contact);
          return email ?? <MissingFieldBadge label={t("messaging.missingEmail")} />;
        },
      });
    }

    return cols;
  }, [showRecipientCol, showPhoneCol, showEmailCol, t]);

  return (
    <WorkBatchTable<Contact>
      data={contacts}
      columns={columns}
      selection={{
        selectedIds: selectedIdsArray,
        onSelectOne: (id: string) => {
          const found = contacts.find((c) => String(c.id) === id);
          if (found) onToggleRecipient(found);
        },
        onSelectAll: () => onToggleAllVisible(!allVisibleSelected),
        allSelected: allVisibleSelected,
        someSelected: someVisibleSelected,
        selectAllAriaLabel: t("messaging.selectAllVisible"),
        selectRowAriaLabel: (contact) =>
          t("messaging.selectRecipient", { name: getDisplayName(contact) }),
      }}
      columnResize={{
        getColumnWidth,
        onColumnResize: setColumnWidth,
      }}
      footerCount={{
        selectedCountLabel: String(selectedCountLabel),
        pageCountLabel: String(pageCountLabel),
      }}
      className="table-fixed text-xs"
    />
  );
}
