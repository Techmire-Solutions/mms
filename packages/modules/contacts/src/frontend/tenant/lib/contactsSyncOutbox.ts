import { getDisplayName } from "@mms/contracts";
import type { ContactsOutboxEntry } from "./contactsSyncOutboxStorage.js";

export {
  currentContactsSyncKeys,
  getContactsOutbox,
  getContactsSyncConflicts,
  type ContactsOutboxEntry,
  type ContactsSyncConflict,
} from "./contactsSyncOutboxStorage.js";

export {
  clearContactsSyncConflicts,
  dismissContactsSyncConflict,
  requeueContactsSyncConflict,
  requeueAllContactsSyncConflicts,
} from "./contactsSyncOutboxConflicts.js";

export {
  enqueueContactsOutbox,
  flushContactsOutbox,
  isRetryableContactsOutboxError,
} from "./contactsSyncOutboxFlush.js";

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
