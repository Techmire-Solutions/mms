import {
  getDisplayName,
  getPrimaryEmail,
  getPrimaryPhone,
  toMessagingRecipient,
  type Contact,
  type StandardMessagingRecipient as MessagingRecipient,
} from "@mms/shared";

/** Selected Work recipients keyed by contact id (snapshots — no async resolve race). */
export type MessagingSelectedMap = Record<string, MessagingRecipient>;

export function contactToRecipient(contact: Contact): MessagingRecipient {
  return toMessagingRecipient(contact, {
    getDisplayName,
    getPrimaryPhone,
    getPrimaryEmail,
  });
}
