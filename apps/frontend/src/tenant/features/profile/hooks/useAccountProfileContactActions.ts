import { useState } from "react";
import {
  getPrimaryEmail,
  getPrimaryPhone,
  ownContactPatchBodySchema,
  type EmailAddress,
  type PhoneNumber,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useTenantProfile, type TenantProfileData } from "@/tenant/hooks/useTenantProfile";

import { getApiValidationMessage } from "@/lib/apiValidationMessage";
import { notify } from "@/lib/notify";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { TENANT_PROFILE_KEY } from "@/tenant/hooks/useTenantProfile";
import { tsrClient } from "@/lib/api";
import { assertContractOk } from "@/lib/apiContractError";

/** Replaces the primary phone entry, preserving any secondary numbers. */
function upsertPrimaryPhone(existing: readonly PhoneNumber[], number: string): PhoneNumber[] {
  const idx = existing.findIndex((phone) => phone.isPrimary);
  if (idx >= 0) {
    const next = [...existing];
    next[idx] = {
      ...existing[idx],
      number,
      isPrimary: true,
      label: existing[idx].label || "Primary",
    };
    return next;
  }
  return [{ label: "Primary", number, isPrimary: true }, ...existing];
}

/** Replaces the primary email entry, preserving secondaries; resets verification on change. */
function upsertPrimaryEmail(existing: readonly EmailAddress[], address: string): EmailAddress[] {
  const idx = existing.findIndex((email) => email.isPrimary);
  if (idx >= 0) {
    const next = [...existing];
    const changed = existing[idx].address !== address;
    next[idx] = {
      ...existing[idx],
      address,
      isPrimary: true,
      label: existing[idx].label || "Primary",
      isVerified: changed ? undefined : existing[idx].isVerified,
    };
    return next;
  }
  return [{ label: "Primary", address, isPrimary: true }, ...existing];
}

/** Editable contact-field values derived from the profile payload. */
function contactFieldSeed(profile: TenantProfileData | undefined): {
  name: string;
  phone: string;
  contactEmail: string;
} {
  if (!profile) return { name: "", phone: "", contactEmail: "" };
  return {
    name: profile.contact?.name ?? profile.name ?? "",
    phone: profile.contact
      ? getPrimaryPhone(profile.contact) || ""
      : String(Reflect.get(profile, "phone") ?? ""),
    contactEmail: profile.contact
      ? getPrimaryEmail(profile.contact) || ""
      : String(Reflect.get(profile, "email") ?? ""),
  };
}

export function useAccountProfileContactActions() {
  const { t } = useTranslation();
  const { checkUserAuth } = useAuth();
  const queryClient = useQueryClient();
  const { data: profile, refetch } = useTenantProfile();

  const updateContactMutation = tsrClient.profile.updateContact.useMutation();

  const seededFields = contactFieldSeed(profile);
  const [name, setName] = useState(seededFields.name);
  const [phone, setPhone] = useState(seededFields.phone);
  const [contactEmail, setContactEmail] = useState(seededFields.contactEmail);
  const [savingContact, setSavingContact] = useState(false);
  const [previousProfile, setPreviousProfile] = useState(profile);

  // Re-seed the editable contact fields during render whenever the profile payload changes.
  if (previousProfile !== profile) {
    setPreviousProfile(profile);
    if (profile) {
      const nextFields = contactFieldSeed(profile);
      setName(nextFields.name);
      setPhone(nextFields.phone);
      setContactEmail(nextFields.contactEmail);
    }
  }

  /** Persists the own-contact patch (shared by Save and avatar crop). Empty arrays clear. */
  const persistOwnContact = async (avatar: string | undefined): Promise<void> => {
    if (!profile?.contact) return;
    setSavingContact(true);
    try {
      const trimmedPhone = phone.trim();
      const trimmedEmail = contactEmail.trim().toLowerCase();
      const existingPhones = profile.contact.phones ?? [];
      const existingEmails = profile.contact.emails ?? [];
      // Empty array is authoritative — clears the collection (form-architecture §3).
      const phones = trimmedPhone ? upsertPrimaryPhone(existingPhones, trimmedPhone) : [];
      const emails = trimmedEmail ? upsertPrimaryEmail(existingEmails, trimmedEmail) : [];
      const checked = ownContactPatchBodySchema.safeParse({
        name: name.trim(),
        phone: trimmedPhone,
        phones,
        emails,
        avatar,
      });
      if (!checked.success) {
        notify.error(t("common.formPleaseFixErrors"));
        return;
      }

      const { status } = await updateContactMutation.mutateAsync({
        body: checked.data,
      });
      assertContractOk({ status }, t("errors.boundary.description"));

      await queryClient.invalidateQueries({ queryKey: TENANT_PROFILE_KEY });
      await refetch();
      await checkUserAuth();
      notify.success(t("account.contactSaved"));
    } catch (error: unknown) {
      const validationMessage = getApiValidationMessage(error);
      const message = validationMessage || t("errors.boundary.description");
      notify.error(validationMessage ? t("account.contactUniqueConflict") : message, {
        description: validationMessage || undefined,
      });
    } finally {
      setSavingContact(false);
    }
  };

  const handleSaveContact = (): Promise<void> =>
    persistOwnContact(profile?.contact?.avatar ?? undefined);

  const handleAvatarCrop = (url: string): Promise<void> => persistOwnContact(url);

  return {
    name,
    phone,
    contactEmail,
    savingContact,
    setName,
    setPhone,
    setContactEmail,
    handleSaveContact,
    handleAvatarCrop,
  };
}
