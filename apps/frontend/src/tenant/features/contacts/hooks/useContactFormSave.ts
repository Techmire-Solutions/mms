import { useCallback, useState } from "react";
import { notify } from "@/lib/notify";
import { useTranslation } from "@/hooks/useTranslation";
import { useContactConfig } from "@/lib/contexts/ContactConfigContext";
import { useGlobalSettings } from "@/tenant/hooks/useGlobalSettings";
import { useContactValidation } from "@/lib/contacts/useContactValidation";
import { getApiValidationErrors, getApiValidationMessage } from "@/lib/apiValidationMessage";
import { validateContactDraftErrors } from "@/tenant/features/contacts/hooks/contactFormDraftValidator";
import {
  applyTitleCaseToContact,
  composeContactName,
  type Contact,
  todayISO,
  cleanContactDraft,
  syncContactScalarFields,
  normalizeToE164,
  parsePhoneNumber,
  isContactDeleted,
  type ValidationError,
  formatSocialPlatformUrl,
} from "@mms/shared";

export function useContactFormSave({
  contact,
  contactDraft,
  defaultCountryCode,
  onSave,
  onClose,
  onValidationTab,
  onBaselineReset,
}: {
  contact?: Contact;
  contactDraft: Partial<Contact>;
  defaultCountryCode: string;
  onSave: (contact: Contact) => void | Promise<void>;
  onClose: () => void;
  onValidationTab: (tabId: string, fieldId?: string, index?: number) => void;
  onBaselineReset?: (contact: Contact) => void;
}) {
  const { t } = useTranslation();
  const { fields } = useContactConfig();
  const { language } = useGlobalSettings();
  const validate = useContactValidation();
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  const handleSave = useCallback(
    async (options?: { keepOpen?: boolean }): Promise<boolean> => {
      setValidationErrors([]);

      if (contact && isContactDeleted(contact)) {
        notify.error(t("contacts.form.cannotEditDeleted"));
        return false;
      }

      const cleanedDraft = cleanContactDraft(contactDraft);
      const formErrors = validateContactDraftErrors({
        cleanedDraft,
        fields,
        language,
        validateBase: validate,
        t,
      });

      if (formErrors.length > 0) {
        setValidationErrors(formErrors);
        const firstError = formErrors[0];
        if (firstError?.tabId) {
          onValidationTab(firstError.tabId, firstError.fieldId, firstError.index);
        }
        notify.error(t("contacts.form.pleaseFixErrors"));
        return false;
      }

      setSaving(true);
      try {
        const firstName = cleanedDraft.firstName || "";
        const lastName = cleanedDraft.lastName || "";

        const normalizedPhones = (cleanedDraft.phones || []).map((phone) => {
          const fallbackCode = phone.countryCode || defaultCountryCode;
          const trimmedNumber = (phone.number || "").trim();
          const parsedRaw = parsePhoneNumber(trimmedNumber, fallbackCode);
          const e164 = normalizeToE164(parsedRaw.countryCode, parsedRaw.number);
          const parsed = parsePhoneNumber(e164, parsedRaw.countryCode);
          const prevDigits = (phone.number || "").replace(/\D/g, "");
          const nextDigits = (parsed.number || "").replace(/\D/g, "");
          const whatsappStatus = phone.whatsappStatus;

          return {
            ...phone,
            countryCode: parsed.countryCode,
            number: parsed.number,
            ...(prevDigits === nextDigits && whatsappStatus ? { whatsappStatus } : {}),
          };
        });

        const normalizedSocials = (cleanedDraft.socials || []).map((social) => ({
          ...social,
          url: formatSocialPlatformUrl(social.platform, social.url),
        }));

        const contactRaw: Contact = {
          ...cleanedDraft,
          id: cleanedDraft.id || contact?.id || crypto.randomUUID(),
          firstName,
          lastName,
          name: composeContactName(firstName, lastName),
          phones: normalizedPhones,
          socials: normalizedSocials,
          updatedAt: todayISO(),
          createdAt: cleanedDraft.createdAt || todayISO(),
        } as Contact;

        const titleCased = applyTitleCaseToContact(contactRaw) as Contact;
        const finalized = syncContactScalarFields(titleCased);

        await onSave(finalized);
        onBaselineReset?.(finalized);

        if (!options?.keepOpen) {
          notify.success(
            contact ? t("contacts.form.contactUpdated") : t("contacts.form.contactCreated"),
          );
          onClose();
        }
        return true;
      } catch (err: unknown) {
        const apiErrors = getApiValidationErrors(err);
        if (apiErrors && apiErrors.length > 0) {
          setValidationErrors(apiErrors);
          const firstError = apiErrors[0];
          if (firstError?.tabId) {
            onValidationTab(firstError.tabId, firstError.fieldId, firstError.index);
          }
          notify.error(t("contacts.form.pleaseFixErrors"), {
            description: firstError?.message ?? getApiValidationMessage(err),
          });
          return false;
        }
        const description =
          getApiValidationMessage(err) || (err instanceof Error ? err.message : undefined);
        notify.error(t("settings.serverSaveFailed"), {
          description,
        });
        return false;
      } finally {
        setSaving(false);
      }
    },
    [
      contact,
      contactDraft,
      defaultCountryCode,
      onSave,
      onClose,
      onValidationTab,
      onBaselineReset,
      fields,
      language,
      validate,
      t,
    ],
  );

  return { saving, validationErrors, setValidationErrors, handleSave };
}
