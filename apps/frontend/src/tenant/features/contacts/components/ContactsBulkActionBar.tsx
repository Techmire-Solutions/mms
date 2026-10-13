import React, { useState } from "react";
import { Users, Tag } from "lucide-react";
import { CONTACTS_MODULE_MANIFEST, type Contact } from "@mms/shared";
import { ModuleUniversalBulkActionBar } from "@/components/app/ModuleUniversalBulkActionBar";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { ContactsBulkTagModal } from "@/tenant/features/contacts/components/ContactsBulkTagModal";

export interface ContactsBulkActionBarProps {
  selectedCount: number;
  viewingDeleted: boolean;
  bulkActions?: readonly string[];
  canWriteMessaging: boolean;
  canExport: boolean;
  canDelete: boolean;
  canWrite?: boolean;
  selectedTargets: {
    waTargets: Contact[];
    smsReady: Contact[];
    emailReady: Contact[];
  };
  onWhatsApp: (targets: Contact[]) => void;
  onSms: (targets: Contact[]) => void;
  onEmail: (targets: Contact[]) => void;
  onBulkExport: () => void | Promise<void>;
  /** Server export in flight — disables the export CTA and swaps in a spinner. */
  isExporting?: boolean;
  onRequestBulkDelete: () => void;
  onRequestBulkRestore: () => void;
  onClearSelection: () => void;
  onBulkTag?: (tags: string[]) => Promise<void> | void;
  isTagPending?: boolean;
}

/** Contacts Work bulk bar — delegates core actions to ModuleUniversalBulkActionBar. */
export const ContactsBulkActionBar = React.memo(function ContactsBulkActionBar({
  selectedCount,
  viewingDeleted,
  bulkActions = CONTACTS_MODULE_MANIFEST.work.bulkActions,
  canWriteMessaging,
  canExport,
  canDelete,
  canWrite,
  selectedTargets,
  onWhatsApp,
  onSms,
  onEmail,
  onBulkExport,
  isExporting,
  onRequestBulkDelete,
  onRequestBulkRestore,
  onClearSelection,
  onBulkTag,
  isTagPending,
}: ContactsBulkActionBarProps): React.JSX.Element {
  const { t } = useTranslation();
  const [tagModalOpen, setTagModalOpen] = useState(false);

  return (
    <>
      <ModuleUniversalBulkActionBar<Contact>
        selectedCount={selectedCount}
        viewingDeleted={viewingDeleted}
        canWrite={canWrite}
        canDelete={canDelete}
        canExport={canExport}
        canWriteMessaging={canWriteMessaging}
        leadingIcon={Users}
        i18nNamespace="contacts"
        bulkActions={bulkActions}
        onClearSelection={onClearSelection}
        onRequestBulkDelete={onRequestBulkDelete}
        onRequestBulkRestore={onRequestBulkRestore}
        messagingTargets={selectedTargets}
        onWhatsApp={onWhatsApp}
        onSms={onSms}
        onEmail={onEmail}
        exportAction={
          bulkActions.includes("export") && canExport
            ? {
                label: t("contacts.bulkExport"),
                onClick: onBulkExport,
                isPending: isExporting,
              }
            : undefined
        }
        deleteLabel={t("contacts.bulkDelete")}
        restoreLabel={t("contacts.bulkRestore")}
        extraActions={
          !viewingDeleted && canWrite && onBulkTag ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTagModalOpen(true)}
              className="min-h-11 gap-1.5 px-3 font-medium text-xs border-border/60 hover:bg-muted/80"
            >
              <Tag className="w-3.5 h-3.5" aria-hidden />
              <span>{t("contacts.bulkTag")}</span>
            </Button>
          ) : undefined
        }
      />
      {tagModalOpen && onBulkTag ? (
        <ContactsBulkTagModal
          open={tagModalOpen}
          onClose={() => setTagModalOpen(false)}
          selectedCount={selectedCount}
          onConfirm={onBulkTag}
          isPending={isTagPending}
        />
      ) : null}
    </>
  );
});
