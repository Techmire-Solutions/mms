import { getPrimaryEmail, getPrimaryPhone, hasWhatsApp, type Contact } from "@mms/contracts";
import { computeModuleMessagingSelectionTargets } from "@/lib/messaging/computeModuleMessagingSelectionTargets";

interface ContactsSelectionTargets {
  waTargets: Contact[];
  smsReady: Contact[];
  emailReady: Contact[];
}

/** Pure eligibility for bulk messaging from current-page rows ∩ selected ids. */
export function computeContactsSelectionTargets({
  selectedIds,
  workContacts,
}: {
  selectedIds: ReadonlyArray<string | number>;
  workContacts: Contact[];
}): ContactsSelectionTargets {
  const { waTargets, smsReady, emailReady } = computeModuleMessagingSelectionTargets({
    selectedIds,
    rows: workContacts,
    hasWhatsApp: (contact) => hasWhatsApp(contact),
    hasSms: (contact) => Boolean(getPrimaryPhone(contact)),
    hasEmail: (contact) => Boolean(getPrimaryEmail(contact)),
  });
  return { waTargets, smsReady, emailReady };
}
