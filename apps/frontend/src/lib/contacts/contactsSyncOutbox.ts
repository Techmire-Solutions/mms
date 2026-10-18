import { getDisplayName } from "@mms/shared";
import type { ContactsOutboxEntry } from "@/lib/contacts/contactsSyncOutboxStorage";

export {
  OUTBOX_KEY,
  CONFLICTS_KEY,
  getContactsOutbox,
  getContactsSyncConflicts,
  type ContactsOutboxEntry,
  type ContactsSyncConflict,
} from "@/lib/contacts/contactsSyncOutboxStorage";

export {
  clearContactsSyncConflicts,
  dismissContactsSyncConflict,
  requeueContactsSyncConflict,
  requeueAllContactsSyncConflicts,
} from "@/lib/contacts/contactsSyncOutboxConflicts";

export { enqueueContactsOutbox, flushContactsOutbox } from "@/lib/contacts/contactsSyncOutboxFlush";

export function describeContactsOutboxEntry(entry: ContactsOutboxEntry): {
  title: string;
  subtitle: string;
} {
  if (entry.kind === "upsert") {
    const name = getDisplayName(entry.contact) || String(entry.contact.id);
    return { title: name, subtitle: "upsert" };
  }
  if (entry.kind === "update") {
    const name = getDisplayName(entry.contact) || entry.contactId;
    return { title: String(name), subtitle: "update" };
  }
  return { title: entry.contactId, subtitle: "delete" };
}
