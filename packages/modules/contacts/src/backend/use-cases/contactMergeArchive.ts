import type { Contact } from "@mms/contracts";
import { emitOutboxEvent } from "@mms/be-core/data/outbox";
import type { ContactsRepository } from "../repository/contactsRepository.js";

/**
 * Archives the merged-away contact. The survivor may inherit a workspace-unique
 * value from it (e.g. `cnic`), so the archive runs before the survivor save to
 * avoid a false "duplicate CNIC". Its child rows are cleared here (they are
 * merged into the survivor by the caller) so they neither linger orphaned nor
 * collide under the phone/email unique indexes. relationship/relationshipContacts
 * are intentionally NOT cleared — `reparentContactReferences` re-points them.
 */
export async function archiveMergeLoser(
  repo: ContactsRepository,
  tenant: string,
  other: Contact,
  keepId: string,
  deleteId: string,
  deletedBy: string,
): Promise<void> {
  const now = new Date().toISOString();
  await repo.save(tenant, {
    ...other,
    deletedAt: now,
    deletedBy,
    deletionReason: `Merged into ${keepId}`,
    updatedAt: now,
    phones: [],
    emails: [],
    addresses: [],
    socials: [],
    education: [],
    experience: [],
    skills: [],
    bankDetails: [],
    activities: [],
    attachments: [],
  });
  // The merged-away contact is a soft-delete in effect: emit the same CDC event
  // the interactive delete path does so downstream subscribers learn it.
  await emitOutboxEvent("entity.soft_deleted", {
    entityType: "contacts",
    entityId: String(deleteId),
    tenantId: tenant,
    deletedAt: now,
    deletedBy,
    deletionReason: `Merged into ${keepId}`,
    version: Date.now(),
  });
}
