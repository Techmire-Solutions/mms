import { hydrateContactRelationshipFields, type Contact } from "@mms/shared";
import { contacts } from "../schema.js";
import { withTenant, type TenantTransaction } from "../tenant-context.js";
import {
  countContactsByWorkspace,
  findContactById,
  findContactsByIds,
  listContactsByWorkspace,
} from "./contactRepositoryHydrate.js";
import { syncContactChildrenTx } from "./contactRepositoryPersistChildren.js";
import { invalidateMultiTierCache } from "../../lib/cache/index.js";
import {
  type ContactInsert,
  contactWriteValues,
  contactUpdateSetValues,
} from "./contactRepositoryValues.js";
import {
  bulkSoftDeleteContactsSql,
  bulkRestoreContactsSql,
} from "./contactRepositorySoftDelete.js";
import { bulkSaveContacts, replaceContactsForWorkspace } from "./contactRepositoryBulkSave.js";

export {
  type ContactInsert,
  contactWriteValues,
  contactUpdateSetValues,
  bulkSoftDeleteContactsSql,
  bulkRestoreContactsSql,
  bulkSaveContacts,
  replaceContactsForWorkspace,
};

type Transaction = TenantTransaction;

export async function persistContactTx(
  tx: Transaction,
  subdomain: string,
  rawContact: Contact,
): Promise<void> {
  const contact = hydrateContactRelationshipFields(rawContact);

  await tx
    .insert(contacts)
    .values(contactWriteValues(subdomain, contact))
    .onConflictDoUpdate({
      target: [contacts.workspaceSubdomain, contacts.id],
      set: contactUpdateSetValues(subdomain, contact),
    });

  await syncContactChildrenTx(tx, subdomain, String(contact.id), contact);
}

export async function saveContact(tenant: string, contact: Contact): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await persistContactTx(tx, subdomain, contact);
  });
  await invalidateMultiTierCache({
    tenantId: subdomain,
    domain: "contacts",
    key: String(contact.id),
  });
}

export const contactRepo = {
  listByWorkspace: listContactsByWorkspace,
  countByWorkspace: countContactsByWorkspace,
  findById: findContactById,
  findByIds: findContactsByIds,
  save: saveContact,
  bulkSave: bulkSaveContacts,
  bulkSoftDelete: bulkSoftDeleteContactsSql,
  bulkRestore: bulkRestoreContactsSql,
  replaceForWorkspace: replaceContactsForWorkspace,
};
