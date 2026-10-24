import React, { lazy, Suspense, useEffect, useMemo, useCallback } from "react";
import { CONTACTS_MODULE_MANIFEST, type Contact, toTitleCase } from "@mms/shared";
import { getScopedBrandingSettings } from "@/lib/settingsPreviewStore";
import { useTranslation } from "@/hooks/useTranslation";
import { useContactConfig } from "@/lib/contexts/ContactConfigContext";
import { useContactMutations } from "@/tenant/hooks/collections/contacts";
import { useModulePermissions } from "@/tenant/hooks/usePermissions";
import { notify } from "@/lib/notify";

const ContactForm = lazy(() => import("@/tenant/features/contacts/components/ContactForm"));

function nameToDraft(name: string): Partial<Contact> {
  const trimmed = name.trim();
  if (!trimmed) return {};
  const parts = trimmed.split(/\s+/).map((p) => toTitleCase(p));
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
    name: parts.join(" "),
  };
}

export interface ContactCreateDefaults {
  gender?: string;
  lockGender?: boolean;
}

export interface ContactCreateModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (contact: Contact) => void;
  initialName?: string;
  createDefaults?: ContactCreateDefaults;
}

/**
 * Canonical quick-create contact dialog — wraps the full Contacts module form.
 * Used from ContactPicker and anywhere a new person must be added inline.
 */
export default function ContactCreateModal({
  open,
  onClose,
  onCreated,
  initialName = "",
  createDefaults,
}: ContactCreateModalProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const { prefs } = useContactConfig();
  const { upsertContact } = useContactMutations();
  const { canWrite } = useModulePermissions(CONTACTS_MODULE_MANIFEST);

  const initialDraft = useMemo(() => {
    const draft = nameToDraft(initialName);
    if (createDefaults?.gender) {
      draft.gender = createDefaults.gender;
    }
    return draft;
  }, [initialName, createDefaults?.gender]);

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
      const payload = { ...contactPayload, id: contactPayload.id ?? crypto.randomUUID() };
      const response = await upsertContact.mutateAsync(payload);
      onCreated(response.contact);
    },
    [canWrite, onCreated, t, upsertContact],
  );

  if (!open || !canWrite) return null;

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
        key={`create-${initialName}-${createDefaults?.gender ?? ""}`}
        open
        priority
        initialDraft={initialDraft}
        lockGender={createDefaults?.lockGender === true}
        defaultCountry={prefs.defaultCountry || branding.country || ""}
        defaultCity={prefs.defaultCity || branding.city || ""}
        defaultProvince={prefs.defaultProvince || branding.region || ""}
        onClose={onClose}
        onSave={handleSave}
      />
    </Suspense>
  );
}
