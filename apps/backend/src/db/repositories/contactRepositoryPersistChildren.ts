import type { Contact } from "@mms/shared";
import { type TenantTransaction } from "../tenant-context.js";
import {
  syncContactPersonalChildrenTx,
  bulkInsertContactPersonalChildrenTx,
} from "./contactPersistPersonalChildren.js";
import {
  syncContactProfessionalChildrenTx,
  bulkInsertContactProfessionalChildrenTx,
} from "./contactPersistProfessionalChildren.js";
import {
  syncContactEngagementChildrenTx,
  bulkInsertContactEngagementChildrenTx,
} from "./contactPersistEngagementChildren.js";

type Transaction = TenantTransaction;

export async function syncContactChildrenTx(
  tx: Transaction,
  subdomain: string,
  contactId: string,
  contact: Contact,
): Promise<void> {
  await syncContactPersonalChildrenTx(tx, subdomain, contactId, contact);
  await syncContactProfessionalChildrenTx(tx, subdomain, contactId, contact);
  await syncContactEngagementChildrenTx(tx, subdomain, contactId, contact);
}

export async function bulkInsertContactChildrenTx(
  tx: Transaction,
  subdomain: string,
  rawContacts: Contact[],
): Promise<void> {
  await bulkInsertContactPersonalChildrenTx(tx, subdomain, rawContacts);
  await bulkInsertContactProfessionalChildrenTx(tx, subdomain, rawContacts);
  await bulkInsertContactEngagementChildrenTx(tx, subdomain, rawContacts);
}
