import { useCallback, useRef, useState } from "react";
import { notify } from "@/lib/notify";
import { useTranslation } from "@/hooks/useTranslation";
import { useContactConfig } from "@/lib/contexts/ContactConfigContext";
import { useGlobalSettings } from "@/tenant/hooks/useGlobalSettings";
import { useContactValidation } from "@/lib/contacts/useContactValidation";
import { getApiValidationErrors, getApiValidationMessage } from "@/lib/apiValidationMessage";
import { isConflictError } from "@/lib/apiContractError";
import { validateContactDraftErrors } from "@/tenant/features/contacts/hooks/contactFormDraftValidator";
import {
  applyTitleCaseToContact,
  composeContactName,
  type Contact,
  todayISO,
  cleanContactDraft,
  stripAbsentContactCollections,
  syncContactScalarFields,
  normalizeToE164,
  parsePhoneNumber,
  isContactDeleted,
  type ValidationError,
  formatSocialPlatformUrl,
  uuidv7,
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
  const { fields, isTabFieldRequired, fieldConfigVersion } = useContactConfig();
  const { language } = useGlobalSettings();
  const validate = useContactValidation();
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  // Non-field failures (500/network/409 without field keys) belong in the modal banner,
  // not only in a toast the user can miss.
  const [formError, setFormError] = useState<string | null>(null);

  const performSave = useCallback(
    async (options?: { keepOpen?: boolean }): Promise<boolean> => {
      setValidationErrors([]);
      setFormError(null);

      if (contact && isContactDeleted(contact)) {
        notify.error(t("contacts.form.cannotEditDeleted"));
        return false;
      }

      const cleanedDraft = cleanContactDraft(contactDraft);
      const formErrors = validateContactDraftErrors({
        cleanedDraft,
        fields,
        language,
        isFieldRequired: isTabFieldRequired,
        validateBase: validate,
        t,
        defaultCountryCode,
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
          id: cleanedDraft.id || contact?.id || uuidv7(),
          firstName,
          lastName,
          name: composeContactName(firstName, lastName),
          phones: normalizedPhones,
          socials: normalizedSocials,
          // Keep the timestamp the record was loaded with — the server stamps
          // the new one and uses this value as the optimistic-concurrency token.
          updatedAt: contact?.updatedAt ?? cleanedDraft.updatedAt ?? todayISO(),
          createdAt: cleanedDraft.createdAt || todayISO(),
        } as Contact;

        // A tab the viewer cannot read is absent from the loaded record; the form
        // still rendered blank rows for it. Never send those back — the server
        // would read them as "clear the collection" (R4-03). `Contact` carries an
        // index signature, so it satisfies the helpers' `Record<string, unknown>`
        // bound without an `unknown` cast.
        const withPresence = stripAbsentContactCollections(contactRaw, contact ?? undefined);

        const titleCased = applyTitleCaseToContact(withPresence);
        const finalized = syncContactScalarFields(titleCased);
        // Blueprint version lock: the server rejects a form saved against a field
        // config that changed while it was open (`_blueprintId` = active version).
        const withBlueprint = {
          ...finalized,
          _blueprintId: String(fieldConfigVersion),
        } as Contact;

        await onSave(withBlueprint);
        onBaselineReset?.(withBlueprint);

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
        // The owning write action already toasts; the banner is what the user can act on.
        // A 409 (stale write / duplicate) gets conflict-specific copy, not a generic failure.
        setFormError(
          isConflictError(err)
            ? t("contacts.form.saveConflict")
            : getApiValidationMessage(err) ||
                (err instanceof Error ? err.message : null) ||
                t("settings.serverSaveFailed"),
        );
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
      fieldConfigVersion,
      isTabFieldRequired,
      language,
      validate,
      t,
    ],
  );

  // Contact create runs through both the footer and the form's Enter handler; a
  // same-frame double submit would create two people. The ref is set before the
  // first await (state only disables the button after a re-render).
  const inFlightRef = useRef(false);
  const handleSave = useCallback(
    async (options?: { keepOpen?: boolean }): Promise<boolean> => {
      if (inFlightRef.current) return false;
      inFlightRef.current = true;
      try {
        return await performSave(options);
      } finally {
        inFlightRef.current = false;
      }
    },
    [performSave],
  );

  return { saving, validationErrors, setValidationErrors, formError, handleSave };
}
