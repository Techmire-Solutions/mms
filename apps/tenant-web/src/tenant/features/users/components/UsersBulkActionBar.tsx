import type { ReactElement } from "react";
import { UserCog } from "lucide-react";
import { USERS_MODULE_MANIFEST, type SystemUser } from "@mms/contracts";
import { BulkSelectionBar } from "@mms/fe-core/components/BulkSelectionBar";
import type { BulkSelectionMessageChannel } from "@mms/ui/app/BulkSelectionActions";
import { useTranslation } from "@mms/fe-core/i18n";

export interface UsersBulkActionBarProps {
  selectedIds: string[];
  selectedUsers: SystemUser[];
  showDeleted: boolean;
  canDelete: boolean;
  onMessage?: (channel: BulkSelectionMessageChannel, users: SystemUser[]) => void;
  onBulkDelete: (ids: string[]) => void;
  onBulkRestore: (ids: string[]) => void;
  onClearSelection: () => void;
  bulkActions?: readonly string[];
}

/** Users Work bulk bar — delegates to shared BulkSelectionBar. */
export function UsersBulkActionBar({
  selectedIds,
  selectedUsers,
  showDeleted,
  canDelete,
  onMessage,
  onBulkDelete,
  onBulkRestore,
  onClearSelection,
  bulkActions = USERS_MODULE_MANIFEST.work.bulkActions,
}: UsersBulkActionBarProps): ReactElement {
  const { t } = useTranslation();

  return (
    <BulkSelectionBar
      selectedCount={selectedIds.length}
      viewingDeleted={showDeleted}
      canDelete={canDelete}
      canWriteMessaging={Boolean(onMessage)}
      leadingIcon={UserCog}
      i18nNamespace="users"
      bulkActions={bulkActions}
      onClearSelection={onClearSelection}
      onRequestBulkDelete={() => {
        onBulkDelete(selectedIds);
        onClearSelection();
      }}
      onRequestBulkRestore={() => {
        onBulkRestore(selectedIds);
        onClearSelection();
      }}
      deleteLabel={t("users.trash.bulkDelete")}
      restoreLabel={t("users.trash.bulkRestore")}
      messagingTargets={{
        waTargets: selectedUsers,
        smsReady: selectedUsers,
        emailReady: selectedUsers,
      }}
      onWhatsApp={() => onMessage?.("whatsapp", selectedUsers)}
      onSms={() => onMessage?.("sms", selectedUsers)}
      onEmail={() => onMessage?.("email", selectedUsers)}
    />
  );
}
