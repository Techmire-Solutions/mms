import React from "react";
import { Drawer } from "@/components/app/Drawer";
import { getDisplayName, type Contact } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useContactDetailAttachments } from "@/tenant/features/contacts/hooks/useContactDetailAttachments";
import { useContactDetailViewModel } from "@/tenant/features/contacts/hooks/useContactDetailViewModel";
import { ConfirmAlertDialog } from "@/components/app/ConfirmAlertDialog";
import { ContactDetailDrawerContent } from "./detail/ContactDetailDrawerContent";
import {
  ContactDetailDrawerArchivedBanner,
  ContactDetailDrawerFooter,
  ContactDetailDrawerHeaderActions,
  ContactDetailDrawerTabBar,
} from "./detail/ContactDetailDrawerChrome";

export interface ContactDetailProps {
  contact: Contact;
  onClose: () => void;
  onEdit: (contact: Contact) => void;
  onWhatsApp?: (contacts: Contact[]) => void;
  onSms?: (contacts: Contact[]) => void;
  onEmail?: (contacts: Contact[]) => void;
  allContacts?: Contact[];
  onUpdateContact?: (contact: Contact) => Promise<void>;
  canWrite?: boolean;
  canDelete?: boolean;
  onRestore?: (contactId: string | number) => void | Promise<void>;
  onNavigateToContact?: (contactId: string | number) => void;
}

/**
 * Contacts Detail Drawer: orchestrates tab state, timeline notes, file uploads,
 * communications actions, and soft-delete/restore operations within {@link Drawer}.
 */
export function ContactDetail({
  contact: initialContact,
  onClose,
  onEdit,
  onWhatsApp,
  onSms,
  onEmail,
  allContacts = [],
  onUpdateContact,
  canWrite = false,
  canDelete = false,
  onRestore,
  onNavigateToContact,
}: ContactDetailProps): React.JSX.Element {
  const { t } = useTranslation();

  const {
    contactState,
    setContactState,
    canPersistContact,
    detailTabs,
    activeTab,
    setActiveTab,
    grouped,
    formatFieldValue,
    visibleCollectionFields,
    combinedActivities,
    primaryPhone,
    primaryEmail,
    handleAddNote,
    handleNavigateToContact,
  } = useContactDetailViewModel({
    initialContact,
    allContacts,
    onUpdateContact,
    canWrite,
    onNavigateToContact,
  });

  const displayName = getDisplayName(contactState);
  const isArchived = Boolean(contactState.deletedAt);
  const hasFooterStamp = Boolean(contactState.updatedAt || contactState.createdAt);

  const {
    isDragging,
    setIsDragging,
    isUploading,
    pendingAttachmentDelete,
    setPendingAttachmentDelete,
    fileInputRef,
    handleFiles,
    handleFileChange,
    confirmAttachmentDelete,
  } = useContactDetailAttachments({
    contactState,
    setContactState,
    canPersistContact,
    onUpdateContact,
  });

  const headerActionsNode = (
    <ContactDetailDrawerHeaderActions
      canWrite={canWrite}
      canDelete={canDelete}
      contact={contactState}
      onEdit={onEdit}
      onRestore={onRestore}
    />
  );

  const headerExtraNode = (
    <div className="space-y-2">
      <ContactDetailDrawerArchivedBanner contact={contactState} />
      <ContactDetailDrawerTabBar
        detailTabs={detailTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
    </div>
  );

  const footerNode = hasFooterStamp ? <ContactDetailDrawerFooter contact={contactState} /> : null;

  return (
    <Drawer
      onClose={onClose}
      title={displayName}
      subtitle={isArchived ? t("contacts.detail.archivedSubtitle") : undefined}
      ariaLabel={t("contacts.detail.ariaLabel", { name: displayName })}
      headerActions={headerActionsNode}
      headerExtra={headerExtraNode}
      footer={footerNode}
    >
      <ContactDetailDrawerContent
        activeTab={activeTab}
        contactState={contactState}
        allContacts={allContacts}
        grouped={grouped}
        formatFieldValue={formatFieldValue}
        visibleCollectionFields={visibleCollectionFields}
        primaryPhone={primaryPhone}
        primaryEmail={primaryEmail}
        onWhatsApp={!isArchived ? onWhatsApp : undefined}
        onSms={!isArchived ? onSms : undefined}
        onEmail={!isArchived ? onEmail : undefined}
        onNavigateToContact={handleNavigateToContact}
        activities={combinedActivities}
        canPersistContact={!isArchived && canPersistContact}
        onAddNote={handleAddNote}
        isDragging={isDragging}
        isUploading={isUploading}
        fileInputRef={fileInputRef}
        onDraggingChange={setIsDragging}
        onFiles={handleFiles}
        onFileChange={handleFileChange}
        onRequestDelete={setPendingAttachmentDelete}
      />
      <ConfirmAlertDialog
        open={pendingAttachmentDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingAttachmentDelete(null);
        }}
        title={t("contacts.detail.confirmDeleteAttachmentTitle")}
        description={t("contacts.detail.confirmDeleteAttachmentDescription", {
          name: pendingAttachmentDelete?.name ?? "",
        })}
        confirmLabel={t("common.delete")}
        onConfirm={() => {
          void confirmAttachmentDelete();
        }}
        destructive
      />
    </Drawer>
  );
}

export const ContactDrawer = ContactDetail;
export default ContactDetail;
