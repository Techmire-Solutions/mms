import type { Contact } from "@mms/shared";
import { getScopedBrandingSettings } from "@/lib/settingsPreviewStore";
import type { ContactsPageOverlaysProps } from "@/tenant/features/contacts/components/ContactsPageOverlays";
import type { useContactsMessagingActions } from "@/tenant/features/contacts/hooks/useContactsMessagingActions";
import type { useContactsPageActions } from "@/tenant/features/contacts/hooks/useContactsPageActions";
import type { useContactsPageOverlayState } from "@/tenant/features/contacts/hooks/useContactsPageOverlayState";

type Overlay = ReturnType<typeof useContactsPageOverlayState>;
type Messaging = ReturnType<typeof useContactsMessagingActions>;
type Actions = ReturnType<typeof useContactsPageActions>;

/** Maps overlay / action slices into ContactsPageOverlaysProps. */
export function useContactsPageOverlayProps({
  canWrite,
  canDelete,
  overlay,
  messaging,
  actions,
  messagingHandlers,
  allContactsForLinks,
  selectedCount,
}: {
  canWrite: boolean;
  canDelete: boolean;
  overlay: Overlay;
  messaging: Pick<Messaging, "messagingTarget" | "closeComposer">;
  actions: Pick<
    Actions,
    | "handleSave"
    | "handleMerge"
    | "handleEdit"
    | "handleRestore"
    | "handleUpdateContact"
    | "handleImport"
    | "confirmBulkDelete"
    | "confirmSingleDelete"
    | "confirmBulkRestore"
  >;
  messagingHandlers: Pick<ContactsPageOverlaysProps, "onWhatsApp" | "onSms" | "onEmail">;
  allContactsForLinks: Contact[];
  selectedCount: number;
}): ContactsPageOverlaysProps {
  const branding = getScopedBrandingSettings();
  const defaultCountry = branding.country || "";
  const defaultCity = branding.city || "";
  const defaultProvince = branding.region || "";

  const currentViewContact = (() => {
    if (!overlay.viewContact) return null;
    const fresh = allContactsForLinks.find((c) => String(c.id) === String(overlay.viewContact?.id));
    return fresh ?? overlay.viewContact;
  })();

  return (() => ({
    canWrite,
    canDelete,
    showForm: overlay.showForm,
    editContact: overlay.editContact,
    defaultCountry,
    defaultCity,
    defaultProvince,
    onCloseForm: () => {
      overlay.setShowForm(false);
      overlay.setEditContact(null);
    },
    onSave: actions.handleSave,
    showDuplicates: overlay.showDuplicates,
    onCloseDuplicates: () => overlay.setShowDuplicates(false),
    onMerge: actions.handleMerge,
    importOpen: canWrite && overlay.importOpen,
    onCloseImport: () => overlay.setImportOpen(false),
    onImportContacts: actions.handleImport,
    csvImportOpen: canWrite && overlay.csvImportOpen,
    onCloseCsvImport: () => overlay.setCsvImportOpen(false),
    messagingTarget: messaging.messagingTarget,
    onCloseComposer: messaging.closeComposer,
    viewContact: currentViewContact,
    onCloseView: () => overlay.setViewContact(null),
    onEditFromDrawer: (contactToEdit: Contact) => {
      overlay.setViewContact(null);
      actions.handleEdit(contactToEdit);
    },
    onNavigateToContactFromDrawer: (targetId: string | number) => {
      const found = allContactsForLinks.find((c) => String(c.id) === String(targetId));
      if (found) {
        overlay.setViewContact(found);
      } else {
        overlay.setViewContact({ id: targetId, firstName: "", name: "" } as Contact);
      }
    },
    onRestoreFromDrawer: canDelete
      ? async (contactId: string | number) => {
          try {
            await actions.handleRestore(contactId);
            overlay.setViewContact(null);
          } catch {
            // Keep drawer open so the user can retry after a failed restore.
          }
        }
      : undefined,
    onWhatsApp: messagingHandlers.onWhatsApp,
    onSms: messagingHandlers.onSms,
    onEmail: messagingHandlers.onEmail,
    allContactsForLinks,
    onUpdateContact: canWrite ? actions.handleUpdateContact : undefined,
    bulkDeleteOpen: overlay.bulkDeleteOpen,
    onBulkDeleteOpenChange: overlay.setBulkDeleteOpen,
    selectedCount,
    onConfirmBulkDelete: actions.confirmBulkDelete,
    deleteTarget: overlay.deleteTarget,
    onDeleteTargetOpenChange: (open: boolean) => {
      if (!open) overlay.setDeleteTarget(null);
    },
    onConfirmSingleDelete: actions.confirmSingleDelete,
    bulkRestoreOpen: overlay.bulkRestoreOpen,
    onBulkRestoreOpenChange: overlay.setBulkRestoreOpen,
    onConfirmBulkRestore: actions.confirmBulkRestore,
  }))();
}
