import React, { useState } from "react";
import { Download, Plus, RotateCcw, Users } from "lucide-react";
import { Badge, Button } from "@shared/ui";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { BulkSelectionBar } from "@/components/app/BulkSelectionBar";
import { ModuleTrashToggle } from "@/components/app/ModuleTrashToggle";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { SectionCard } from "@/components/app/SectionCard";
import { useTranslation } from "@/hooks/useTranslation";
import { useWorkSelection } from "@/hooks/useWorkSelection";
import { useDirectoryTrashState } from "@/hooks/useDirectoryTrashState";
import { notify } from "@/lib/notify";
import type { AppTranslationKey, PlatformMessageDto } from "@mms/shared";
import {
  useDeletePlatformMessage,
  usePlatformMessages,
  useRestorePlatformMessage,
  useSendPlatformMessage,
} from "@/platform/features/messaging/hooks/usePlatformMessaging";
import { MessagingComposeModal } from "@/platform/features/messaging/components/MessagingComposeModal";
import {
  PLATFORM_MESSAGING_CHANNEL_LABEL_KEYS,
} from "@/platform/features/messaging/lib/platformMessagingChannels";
import { exportPlatformMessagesCsv } from "@/platform/features/messaging/lib/exportPlatformMessagesCsv";

const STATUS_LABEL_KEYS: Record<PlatformMessageDto["status"], AppTranslationKey> = {
  queued: "platform.messaging.status.queued",
  sending: "platform.messaging.status.sending",
  sent: "platform.messaging.status.sent",
  delivered: "platform.messaging.status.delivered",
  failed: "platform.messaging.status.failed",
};

/** Messaging → Work: broadcast log + composer (table/cards, selection, bulk, trash). */
export function MessagingWorkTier(): React.JSX.Element {
  const { t } = useTranslation();
  const { viewingDeleted, toggleTrash } = useDirectoryTrashState();
  const [composeOpen, setComposeOpen] = useState(false);

  const { data: messages, isLoading, isError, refetch } = usePlatformMessages({
    deleted: viewingDeleted,
  });
  const send = useSendPlatformMessage();
  const remove = useDeletePlatformMessage();
  const restore = useRestorePlatformMessage();

  const {
    selectedIds,
    visibleIds,
    allVisibleSelected,
    someVisibleSelected,
    toggleSelected,
    toggleSelectAll,
    clearSelection,
  } = useWorkSelection(messages ?? []);

  const handleBulkDelete = async (): Promise<void> => {
    await Promise.all(selectedIds.map((id) => remove.mutateAsync(id)));
    clearSelection();
  };

  const handleBulkRestore = async (): Promise<void> => {
    await Promise.all(selectedIds.map((id) => restore.mutateAsync(id)));
    clearSelection();
  };

  const columns: DataTableColumn<PlatformMessageDto>[] = [
    {
      id: "channel",
      kind: "status",
      label: t("platform.messaging.channel"),
      render: (row) => t(PLATFORM_MESSAGING_CHANNEL_LABEL_KEYS[row.channel]),
    },
    {
      id: "subject",
      kind: "shortText",
      label: t("platform.messaging.subject"),
      render: (row) => row.subject ?? "—",
    },
    {
      id: "status",
      kind: "status",
      label: t("platform.messaging.status"),
      render: (row) => t(STATUS_LABEL_KEYS[row.status]),
    },
    {
      id: "recipients",
      kind: "number",
      label: t("platform.messaging.recipients"),
      render: (row) => String(row.recipientSnapshot.length),
    },
    {
      id: "createdAt",
      kind: "date",
      label: t("platform.messaging.createdAt"),
      render: (row) => row.createdAt,
    },
    {
      id: "actions",
      width: 120,
      label: "",
      render: (row) =>
        viewingDeleted ? (
          <Button
            variant="ghost"
            size="sm"
            icon={RotateCcw}
            onClick={() => void restore.mutateAsync(row.id)}
          >
            {t("common.restore")}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => void remove.mutateAsync(row.id)}
          >
            {t("common.delete")}
          </Button>
        ),
    },
  ];

  return (
    <div className="space-y-4 text-start">
      <SectionCard title={t("platform.messaging.log")} icon={Plus}>
        <div className="flex flex-wrap items-center gap-2">
          {!viewingDeleted ? (
            <>
              <Button
                type="button"
                className="min-h-11"
                icon={Plus}
                onClick={() => setComposeOpen(true)}
              >
                {t("platform.messaging.compose")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                icon={Download}
                disabled={!messages || messages.length === 0}
                onClick={() => exportPlatformMessagesCsv(messages ?? [])}
                title={t("platform.messaging.exportCsv")}
              >
                {t("platform.messaging.exportCsv")}
              </Button>
            </>
          ) : null}
          <ModuleTrashToggle
            viewingDeleted={viewingDeleted}
            onToggle={() => {
              clearSelection();
              toggleTrash();
            }}
            activeLabel={t("platform.messaging.log")}
            deletedLabel={t("platform.messaging.trash")}
          />
        </div>
      </SectionCard>

      <BulkSelectionBar
        selectedCount={selectedIds.length}
        viewingDeleted={viewingDeleted}
        canDelete
        leadingIcon={Users}
        i18nNamespace="platform.messaging"
        onClearSelection={clearSelection}
        deleteLabel={t("common.delete")}
        onRequestBulkDelete={() => void handleBulkDelete()}
        onRequestBulkRestore={() => void handleBulkRestore()}
        restoreLabel={t("common.restore")}
      />

      {isError ? (
        <ErrorState
          description={t("platform.messaging.loadFailed")}
          onRetry={() => void refetch()}
        />
      ) : isLoading ? null : messages && messages.length === 0 ? (
        <EmptyState
          title={viewingDeleted ? t("platform.messaging.trash") : t("platform.messaging.emptyTitle")}
          description={
            viewingDeleted ? t("platform.messaging.trash") : t("platform.messaging.emptyDescription")
          }
        />
      ) : (
        <DataTable
          tableId="platform-messages"
          label={t("platform.messaging.log")}
          data={messages ?? []}
          columns={columns}
          card={{
            title: (row) => row.subject ?? row.channel,
            badge: (row) => (
              <Badge tone="muted" size="sm">
                {t(STATUS_LABEL_KEYS[row.status])}
              </Badge>
            ),
          }}
          selection={{
            selectedIds,
            onSelectOne: (id) => toggleSelected(id, !selectedIds.includes(id)),
            onSelectAll: () => toggleSelectAll(!allVisibleSelected, visibleIds),
            allSelected: allVisibleSelected,
            someSelected: someVisibleSelected,
          }}
        />
      )}

      {composeOpen ? (
        <MessagingComposeModal
          saving={send.isPending}
          onClose={() => setComposeOpen(false)}
          onSend={async (input) => {
            await send.mutateAsync(input);
            notify.success(t("platform.messaging.sent"));
            setComposeOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
