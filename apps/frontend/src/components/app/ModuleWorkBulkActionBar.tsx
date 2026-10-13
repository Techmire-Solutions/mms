import React, { type JSX, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { BulkActionDock } from "@/components/common/BulkActionDock";
import {
  BulkSelectionClearAction,
  BulkSelectionDeleteAction,
  BulkSelectionExportAction,
  BulkSelectionMessagingActions,
  BulkSelectionRestoreAction,
  type BulkSelectionMessageChannel,
} from "@/components/app/BulkSelectionActions";

export interface ModuleWorkBulkActionBarProps {
  selectedCount: number;
  viewingDeleted?: boolean;
  countLabel: string;
  leading: ReactNode;
  deselectLabel: string;
  canDelete: boolean;
  restoreLabel: string;
  onRequestBulkRestore: () => void;
  onClearSelection: () => void;
  /** Live messaging strip (omit when trash or messaging unavailable). */
  messaging?: {
    onChannel: (channel: BulkSelectionMessageChannel) => void;
    labels: {
      whatsapp: string;
      sms: string;
      email?: string;
    };
    channels: {
      whatsapp: boolean;
      sms: boolean;
      email: boolean;
    };
  };
  exportAction?: {
    label: string;
    onClick: () => void | Promise<void>;
    /** Export in flight — disables the CTA and shows a spinner. */
    isPending?: boolean;
  };
  /** Module-specific middle actions (e.g. Students status). */
  extraActions?: ReactNode;
  deleteAction?: {
    label: string;
    onClick: () => void;
  };
}

/** Shared Work bulk selection chrome — Contacts/Students compose labels + slots. */
export const ModuleWorkBulkActionBar = function ModuleWorkBulkActionBar({
  selectedCount,
  viewingDeleted = false,
  countLabel,
  leading,
  deselectLabel,
  canDelete,
  restoreLabel,
  onRequestBulkRestore,
  onClearSelection,
  messaging,
  exportAction,
  extraActions,
  deleteAction,
}: ModuleWorkBulkActionBarProps): JSX.Element {
  const trailingNode = (() => (
    <BulkSelectionClearAction label={deselectLabel} onClick={onClearSelection} />
  ))();

  return (
    <BulkActionDock
      placement="inline"
      tone="glass"
      selectedCount={selectedCount}
      countLabel={countLabel}
      leading={leading}
      trailing={trailingNode}
      onClearSelection={onClearSelection}
      enableEscapeKey={true}
    >
      {viewingDeleted ? (
        canDelete && (
          <BulkSelectionRestoreAction label={restoreLabel} onClick={onRequestBulkRestore} />
        )
      ) : (
        <>
          {messaging && (
            <BulkSelectionMessagingActions
              onChannel={messaging.onChannel}
              labels={messaging.labels}
              channels={messaging.channels}
            />
          )}
          {exportAction && (
            <BulkSelectionExportAction
              label={exportAction.label}
              onClick={exportAction.onClick}
              isPending={exportAction.isPending}
            />
          )}
          {extraActions}
          {deleteAction && (
            <>
              <div className="h-4 w-px bg-border" />
              <BulkSelectionDeleteAction
                label={deleteAction.label}
                onClick={deleteAction.onClick}
                icon={Trash2}
              />
            </>
          )}
        </>
      )}
    </BulkActionDock>
  );
};
