import React, { lazy, Suspense, useEffect, useCallback } from "react";
import { CONTACTS_MODULE_MANIFEST, type Contact } from "@mms/shared";
import { getScopedBrandingSettings } from "@/lib/settingsPreviewStore";
import { useTranslation } from "@/hooks/useTranslation";
import { useContactConfig } from "@/lib/contexts/ContactConfigContext";
import { useContactMutations } from "@/tenant/hooks/collections/contacts";
import { useModulePermissions } from "@/tenant/hooks/usePermissions";
import { notify } from "@/lib/notify";

const ContactForm = lazy(() => import("@/tenant/features/contacts/components/ContactForm"));

export interface ContactEditModalProps {
  open: boolean;
  contact: Contact | null | undefined;
  onClose: () => void;
  onSaved?: (contact: Contact) => void;
}

/**
 * Canonical contact edit dialog — wraps the full Contacts module form.
 * Used from person-linked modules (Students guardians, etc.) without feature→feature imports.
 */
export default function ContactEditModal({
  open,
  contact,
  onClose,
  onSaved,
}: ContactEditModalProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const { prefs } = useContactConfig();
  const { updateContact } = useContactMutations();
  const { canWrite } = useModulePermissions(CONTACTS_MODULE_MANIFEST);

  useEffect(() => {
    if (!open || canWrite) return;
    notify.error(t("contacts.form.writeDenied"));
    onClose();
  }, [open, canWrite, onClose, t]);

  const handleSave = useCallback(
    async (contactPayload: Contact): Promise<void> => {
      if (!canWrite) {
        throw new Error(t("contacts.form.writeDenied"));
      }
      const response = await updateContact.mutateAsync({
        id: String(contactPayload.id),
        contact: contactPayload,
      });
      onSaved?.(response.contact);
    },
    [canWrite, onSaved, t, updateContact],
  );

  if (!open || !canWrite || !contact?.id) return null;

  const branding = getScopedBrandingSettings();

  return (
    <Suspense
      fallback={
        <span role="status" className="sr-only">
          {t("common.loading")}
        </span>
      }
    >
      <ContactForm
        key={`edit-${contact.id}`}
        open
        priority
        contact={contact}
        defaultCountry={prefs.defaultCountry || branding.country || ""}
        defaultCity={prefs.defaultCity || branding.city || ""}
        defaultProvince={prefs.defaultProvince || branding.region || ""}
        onClose={onClose}
        onSave={handleSave}
      />
    </Suspense>
  );
}
