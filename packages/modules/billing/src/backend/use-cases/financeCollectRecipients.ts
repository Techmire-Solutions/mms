import {
  filterActiveContacts,
  getDisplayName,
  getPrimaryEmail,
  getPrimaryPhone,
  resolveContactFieldConfigSnapshot,
  sanitizeContactsForViewer,
  toMessagingRecipient,
  type Contact,
} from "@mms/contracts";
import { loadContactFieldConfig, loadContactsSummaryByIdsForTenant } from "../deps.js";

/**
 * Loads the family contacts for an invoice reminder batch and applies the
 * contacts viewer sanitizer before mapping, exactly like the messaging path: a
 * finance role whose tenant field-config hides phones/emails (or that lacks
 * contacts.read) must not receive them through the reminder DTO.
 */
export async function loadSanitizedReminderContacts(
  tenant: string,
  contactIds: string[],
  viewerRole: string,
): Promise<Map<string, Contact>> {
  if (contactIds.length === 0) return new Map();
  const contacts = await loadContactsSummaryByIdsForTenant(tenant, contactIds);
  const active = filterActiveContacts(contacts);
  const snapshot = resolveContactFieldConfigSnapshot(await loadContactFieldConfig());
  const sanitized = sanitizeContactsForViewer(active, viewerRole, snapshot);
  return new Map(sanitized.map((contact) => [String(contact.id), contact]));
}

/** Maps a sanitized contact to the lean messaging-recipient shape. */
export function reminderRecipient(contact: Contact) {
  return toMessagingRecipient(contact, { getDisplayName, getPrimaryPhone, getPrimaryEmail });
}
