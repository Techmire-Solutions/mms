import React from "react";
import { ModuleTrashConfirmDialogs } from "@/components/app/ModuleTrashConfirmDialogs";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { MessagingTarget } from "@/hooks/useMessageComposerState";

const MessageComposer = React.lazy(
  () => import("@/tenant/components/messaging/TenantMessageComposer"),
);

export interface InvoicesListOverlaysProps {
  messagingTarget: MessagingTarget | null;
  closeComposer: () => void;
  pendingDeleteId: string | null;
  onPendingDeleteIdChange: (id: string | null) => void;
  confirmBulkOpen: boolean;
  onConfirmBulkOpenChange: (open: boolean) => void;
  showDeleted: boolean;
  selectedIds: string[];
  onDelete?: (id: string) => void;
  onBulkDelete?: (ids: string[]) => void;
  onBulkRestore?: (ids: string[]) => void;
  onClearSelection?: () => void;
  t: TranslationFunction;
}

export function InvoicesListOverlays({
  messagingTarget,
  closeComposer,
  pendingDeleteId,
  onPendingDeleteIdChange,
  confirmBulkOpen,
  onConfirmBulkOpenChange,
  showDeleted,
  selectedIds,
  onDelete,
  onBulkDelete,
  onBulkRestore,
  onClearSelection,
  t,
}: InvoicesListOverlaysProps): React.JSX.Element {
  return (
    <>
      {messagingTarget && (
        <React.Suspense fallback={null}>
          <MessageComposer
            channel={messagingTarget.channel}
            recipients={messagingTarget.recipients}
            onClose={closeComposer}
          />
        </React.Suspense>
      )}
      <ModuleTrashConfirmDialogs
        pendingTrashId={pendingDeleteId}
        onPendingTrashIdChange={onPendingDeleteIdChange}
        confirmBulkOpen={confirmBulkOpen}
        onConfirmBulkOpenChange={onConfirmBulkOpenChange}
        showDeleted={showDeleted}
        selectedCount={selectedIds.length}
        i18nNamespace="finance"
        onConfirmRowTrash={() => {
          if (pendingDeleteId) onDelete?.(pendingDeleteId);
          onPendingDeleteIdChange(null);
        }}
        onConfirmBulkTrash={() => {
          if (showDeleted) onBulkRestore?.(selectedIds);
          else onBulkDelete?.(selectedIds);
          onClearSelection?.();
          onConfirmBulkOpenChange(false);
        }}
        labels={{
          singleDescription: t("finance.trash.deleteInvoiceConfirm"),
        }}
      />
    </>
  );
}
