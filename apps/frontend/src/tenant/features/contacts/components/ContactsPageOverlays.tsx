import { lazy, Suspense } from "react";
import { AnimatePresence } from "framer-motion";
import type { Contact, StandardMessagingRecipient } from "@mms/shared";
import {
  ModuleDrawerLoadingSkeleton,
  ModuleOverlayLoadingFallback,
} from "@/components/app/ModuleOverlayLoadingChrome";
import { ContactsPageConfirmDialogs } from "@/tenant/features/contacts/components/ContactsPageConfirmDialogs";
import { ContactsCsvImportDialog } from "@/tenant/features/contacts/components/ContactsCsvImportDialog";
import { ContactsImportDialog } from "@/tenant/features/contacts/components/ContactsImportDialog";
import { useContactConfig } from "@/lib/contexts/ContactConfigContext";
import React from "react";

const ContactForm = lazy(() => import("@/tenant/features/contacts/components/ContactForm"));
const DuplicateDetection = lazy(
  () => import("@/tenant/features/contacts/components/DuplicateDetection"),
);
const MessageComposer = lazy(() => import("@/tenant/components/messaging/TenantMessageComposer"));
const ContactDetail = lazy(() => import("@/tenant/features/contacts/components/ContactDetail"));

export interface ContactsPageOverlaysProps {
  canWrite: boolean;
  canDelete: boolean;
  showForm: boolean;
  editContact: Contact | null;
  defaultCountry: string;
  defaultCity: string;
  defaultProvince: string;
  onCloseForm: () => void;
  onSave: (contact: Contact) => void | Promise<void>;
  showDuplicates: boolean;
  onCloseDuplicates: () => void;
  onMerge: (
    keepId: string | number,
    deleteId: string | number,
    mergedData: Contact,
  ) => Promise<void>;
  importOpen: boolean;
  onCloseImport: () => void;
  onImportContacts: (contacts: Contact[]) => void | Promise<void>;
  csvImportOpen?: boolean;
  onCloseCsvImport?: () => void;
  messagingTarget: {
    channel: "whatsapp" | "sms" | "email";
    recipients: StandardMessagingRecipient[];
  } | null;
  onCloseComposer: () => void;
  viewContact: Contact | null;
  onCloseView: () => void;
  onEditFromDrawer: (contact: Contact) => void;
  onNavigateToContactFromDrawer?: (contactId: string | number) => void;
  onRestoreFromDrawer?: (contactId: string | number) => void;
  onWhatsApp?: (contacts: Contact[]) => void;
  onSms?: (contacts: Contact[]) => void;
  onEmail?: (contacts: Contact[]) => void;
  allContactsForLinks: Contact[];
  onUpdateContact?: (contact: Contact) => Promise<void>;
  bulkDeleteOpen: boolean;
  onBulkDeleteOpenChange: (open: boolean) => void;
  selectedCount: number;
  onConfirmBulkDelete: (reason?: string) => void;
  deleteTarget: { id: string | number; name?: string } | null;
  onDeleteTargetOpenChange: (open: boolean) => void;
  onConfirmSingleDelete: (reason?: string) => void;
  bulkRestoreOpen: boolean;
  onBulkRestoreOpenChange: (open: boolean) => void;
  onConfirmBulkRestore: () => void;
}

export function ContactsPageOverlays({
  canWrite,
  canDelete,
  showForm,
  editContact,
  defaultCountry,
  defaultCity,
  defaultProvince,
  onCloseForm,
  onSave,
  showDuplicates,
  onCloseDuplicates,
  onMerge,
  importOpen,
  onCloseImport,
  onImportContacts,
  csvImportOpen,
  onCloseCsvImport,
  messagingTarget,
  onCloseComposer,
  viewContact,
  onCloseView,
  onEditFromDrawer,
  onNavigateToContactFromDrawer,
  onRestoreFromDrawer,
  onWhatsApp,
  onSms,
  onEmail,
  allContactsForLinks,
  onUpdateContact,
  bulkDeleteOpen,
  onBulkDeleteOpenChange,
  selectedCount,
  onConfirmBulkDelete,
  deleteTarget,
  onDeleteTargetOpenChange,
  onConfirmSingleDelete,
  bulkRestoreOpen,
  onBulkRestoreOpenChange,
  onConfirmBulkRestore,
}: ContactsPageOverlaysProps): React.JSX.Element {
  const { formTabsReady } = useContactConfig();
  const formNeedsTabs = showForm || Boolean(viewContact);
  const tabsPending = formNeedsTabs && !formTabsReady;

  return (
    <>
      {tabsPending ? <ModuleOverlayLoadingFallback /> : null}

      <Suspense fallback={<ModuleOverlayLoadingFallback />}>
        <AnimatePresence>
          {formTabsReady ? (
            <ContactForm
              open={showForm}
              contact={editContact ?? undefined}
              defaultCountry={defaultCountry}
              defaultCity={defaultCity}
              defaultProvince={defaultProvince}
              onClose={onCloseForm}
              onSave={onSave}
            />
          ) : null}
          {showDuplicates && (
            <DuplicateDetection onClose={onCloseDuplicates} onMerge={onMerge} canWrite={canWrite} />
          )}
          {messagingTarget && (
            <MessageComposer
              channel={messagingTarget.channel}
              recipients={messagingTarget.recipients}
              onClose={onCloseComposer}
            />
          )}
        </AnimatePresence>
      </Suspense>

      <ContactsImportDialog
        open={importOpen}
        onClose={onCloseImport}
        onImport={onImportContacts}
        canWrite={canWrite}
      />

      {csvImportOpen !== undefined && onCloseCsvImport ? (
        <ContactsCsvImportDialog
          open={csvImportOpen}
          onClose={onCloseCsvImport}
          canWrite={canWrite}
        />
      ) : null}

      <Suspense fallback={<ModuleDrawerLoadingSkeleton />}>
        <AnimatePresence>
          {viewContact && formTabsReady ? (
            <ContactDetail
              contact={viewContact}
              onClose={onCloseView}
              onEdit={onEditFromDrawer}
              onWhatsApp={onWhatsApp}
              onSms={onSms}
              onEmail={onEmail}
              allContacts={allContactsForLinks}
              onUpdateContact={onUpdateContact}
              canWrite={canWrite}
              canDelete={canDelete}
              onRestore={onRestoreFromDrawer}
              onNavigateToContact={onNavigateToContactFromDrawer}
            />
          ) : null}
        </AnimatePresence>
      </Suspense>

      <ContactsPageConfirmDialogs
        bulkDeleteOpen={bulkDeleteOpen}
        onBulkDeleteOpenChange={onBulkDeleteOpenChange}
        selectedCount={selectedCount}
        onConfirmBulkDelete={onConfirmBulkDelete}
        deleteTarget={deleteTarget}
        onDeleteTargetOpenChange={onDeleteTargetOpenChange}
        onConfirmSingleDelete={onConfirmSingleDelete}
        bulkRestoreOpen={bulkRestoreOpen}
        onBulkRestoreOpenChange={onBulkRestoreOpenChange}
        onConfirmBulkRestore={onConfirmBulkRestore}
      />
    </>
  );
}
