import {
  filterManualContactTags,
  getContactTags,
  mergeContacts as mergeContactRecords,
  type Contact,
} from "@mms/shared";
import { invalidateDuplicateScanCache } from "./contactDuplicateScanUseCases.js";
import { getRequestTenant } from "../../lib/tenantContext.js";
import {
  reconcileContactSystemTags,
  removeSystemTagsForContacts,
} from "../systemTags/contactSystemTagUseCases.js";
import { applyContactRelationshipInference } from "./contactInferenceUseCases.js";
import { runInTransaction } from "../../db/database.js";
import { assertContactUniqueFields, prepareContactRecord } from "./contactValidationUseCases.js";
import { assertContactAttachmentUrls } from "./contactAttachmentUrls.js";
import { loadContactWriteContext } from "./contactWriteContext.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { invalidateMultiTierCache } from "../../lib/cache/index.js";
import { NotFoundError, ValidationError } from "../../lib/httpErrors.js";
import type { ContactsRepository } from "../repository/contactsRepository.js";
import { contactsRepository } from "../repository/contactsRepositoryAdapter.js";

export async function mergeContactsById(
  keepId: string,
  deleteId: string,
  mergedInput: Contact | undefined,
  deletedBy: string,
  repo: ContactsRepository = contactsRepository,
): Promise<Contact> {
  const context = await loadContactWriteContext();
  const saved = await runInTransaction(async () => {
    const tenant = getRequestTenant();
    if (!tenant) throw new Error("Tenant context required");
    if (String(keepId) === String(deleteId)) {
      throw new ValidationError("Cannot merge a contact into itself");
    }
    const keep = await repo.findById(tenant, keepId);
    const other = await repo.findById(tenant, deleteId);
    if (!keep || keep.deletedAt) throw new NotFoundError("Keep contact not found");
    if (!other || other.deletedAt) throw new NotFoundError("Delete contact not found");

    const mergedSource = mergedInput
      ? { ...mergedInput, id: keepId }
      : mergeContactRecords(keep, other);
    const prepared = await prepareContactRecord(mergedSource, keepId, context);
    assertContactAttachmentUrls(prepared, tenant, [
      ...(keep.attachments ?? []).map((attachment) => attachment.url),
      ...(other.attachments ?? []).map((attachment) => attachment.url),
    ]);
    await assertContactUniqueFields(
      tenant,
      prepared,
      { language: "en", excludeContactIds: [deleteId], context },
      [],
      repo,
    );
    const next: Contact = {
      ...keep,
      ...prepared,
      id: keepId,
      createdBy: keep.createdBy,
      updatedBy: deletedBy,
      deletedAt: undefined,
      deletedBy: undefined,
      deletionReason: undefined,
      updatedAt: new Date().toISOString(),
    };

    await repo.save(tenant, next);
    await applyContactRelationshipInference(tenant, next, undefined, repo, {
      actorId: deletedBy,
      previousSource: keep,
    });

    const now = new Date().toISOString();
    await repo.save(tenant, {
      ...other,
      deletedAt: now,
      deletedBy,
      deletionReason: `Merged into ${keepId}`,
      updatedAt: now,
    });

    await repo.reparentContactReferences(tenant, keepId, deleteId);
    // Merge is not a role end: the merged-away contact's system rows go away,
    // while the surviving contact inherits the reconciled roles.
    await removeSystemTagsForContacts(tenant, [deleteId]);
    await reconcileContactSystemTags(tenant, [keepId], {
      actorId: deletedBy,
      touchContacts: false,
    });

    await invalidateDuplicateScanCache();
    return next;
  });
  const tenant = getRequestTenant();
  if (tenant) {
    await invalidateMultiTierCache({ tenantId: tenant, domain: "contacts" });
  }
  await broadcastCollection("contacts");
  return saved;
}

/** Bulk persist pre-validated contacts (Google sync batch import) through the storage gateway. */
export async function bulkSaveContacts(
  contacts: Contact[],
  repo: ContactsRepository = contactsRepository,
): Promise<void> {
  const tenant = getRequestTenant();
  if (!tenant || contacts.length === 0) return;
  await repo.bulkSave(tenant, contacts);
  const ids = contacts
    .map((contact) => contact.id)
    .filter((id): id is string | number => id != null)
    .map(String);
  if (ids.length > 0) {
    await reconcileContactSystemTags(tenant, ids, { touchContacts: false });
  }
  await invalidateMultiTierCache({ tenantId: tenant, domain: "contacts" });
}

export async function bulkTagContacts(
  ids: string[],
  options: { addTags?: string[]; removeTags?: string[]; actorId?: string },
  repo: ContactsRepository = contactsRepository,
): Promise<{ updatedCount: number }> {
  const result = await runInTransaction(async () => {
    const tenant = getRequestTenant();
    if (!tenant) throw new Error("Tenant context required");
    const contactsToUpdate = await repo.findByIds(tenant, ids);
    const toAdd = filterManualContactTags(options.addTags ?? []);
    const toRemove = new Set(
      filterManualContactTags(options.removeTags ?? []).map((t) => t.toLowerCase()),
    );

    const toSave: Contact[] = [];
    for (const c of contactsToUpdate) {
      if (c.deletedAt) continue;
      // Module-managed tags are read-only: compute only over manual tags.
      const currentTags = filterManualContactTags(getContactTags(c));
      const tagSet = new Set(currentTags);
      let changed = false;

      // Case-insensitive on both ends: adding `Maths` to a contact tagged
      // `maths` must not create a duplicate tag, matching the remove behaviour.
      const existingLower = new Set([...tagSet].map((tag) => tag.toLowerCase()));
      for (const tag of toAdd) {
        const key = tag.toLowerCase();
        if (existingLower.has(key)) continue;
        tagSet.add(tag);
        existingLower.add(key);
        changed = true;
      }
      for (const tag of tagSet) {
        if (toRemove.has(tag.toLowerCase())) {
          tagSet.delete(tag);
          changed = true;
        }
      }

      if (!changed) continue;

      const nextTags = [...tagSet];
      const next: Contact = {
        ...c,
        tags: nextTags,
        updatedAt: new Date().toISOString(),
      };
      toSave.push(next);
    }
    if (toSave.length > 0) {
      // Tag-only write: never re-save hydrated children from this snapshot, or a
      // concurrent phone/email edit would be reverted (C-03).
      await repo.replaceContactTags(
        tenant,
        toSave.map((contact) => ({ id: String(contact.id), tags: contact.tags ?? [] })),
        options.actorId,
      );
    }
    return { updatedCount: toSave.length };
  });
  if (result.updatedCount > 0) {
    const tenant = getRequestTenant();
    if (tenant) {
      await invalidateMultiTierCache({ tenantId: tenant, domain: "contacts" });
    }
    await broadcastCollection("contacts");
  }
  return result;
}
