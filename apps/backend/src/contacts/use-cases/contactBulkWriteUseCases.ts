import { getContactTags, mergeContacts as mergeContactRecords, type Contact } from "@mms/shared";
import { invalidateDuplicateScanCache } from "./contactDuplicateScanUseCases.js";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { applyContactRelationshipInference } from "./contactInferenceUseCases.js";
import { runInTransaction } from "../../db/database.js";
import { assertContactUniqueFields, prepareContactRecord } from "./contactValidationUseCases.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { invalidateMultiTierCache } from "../../lib/cache/index.js";
import type { ContactsRepository } from "../repository/contactsRepository.js";
import { contactsRepository } from "../repository/contactsRepositoryAdapter.js";

export async function mergeContactsById(
  keepId: string,
  deleteId: string,
  mergedInput: Contact | undefined,
  deletedBy: string,
  repo: ContactsRepository = contactsRepository,
): Promise<Contact> {
  const saved = await runInTransaction(async () => {
    const tenant = getRequestTenant();
    if (!tenant) throw new Error("Tenant context required");
    if (String(keepId) === String(deleteId)) {
      throw new Error("Cannot merge a contact into itself");
    }
    const keep = await repo.findById(tenant, keepId);
    const other = await repo.findById(tenant, deleteId);
    if (!keep || keep.deletedAt) throw new Error("Keep contact not found");
    if (!other || other.deletedAt) throw new Error("Delete contact not found");

    const mergedSource = mergedInput
      ? { ...mergedInput, id: keepId }
      : mergeContactRecords(keep, other);
    const prepared = await prepareContactRecord(mergedSource, keepId);
    await assertContactUniqueFields(tenant, prepared, "en", [deleteId], repo);
    const next: Contact = {
      ...keep,
      ...prepared,
      id: keepId,
      deletedAt: undefined,
      deletedBy: undefined,
      deletionReason: undefined,
      updatedAt: new Date().toISOString(),
    };

    await repo.save(tenant, next);
    await applyContactRelationshipInference(tenant, next, undefined, repo);

    const now = new Date().toISOString();
    await repo.save(tenant, {
      ...other,
      deletedAt: now,
      deletedBy,
      deletionReason: `Merged into ${keepId}`,
      updatedAt: now,
    });

    await repo.reparentContactReferences(tenant, keepId, deleteId);

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
  await invalidateMultiTierCache({ tenantId: tenant, domain: "contacts" });
}

export async function bulkTagContacts(
  ids: string[],
  options: { addTags?: string[]; removeTags?: string[] },
  repo: ContactsRepository = contactsRepository,
): Promise<{ updatedCount: number }> {
  const result = await runInTransaction(async () => {
    const tenant = getRequestTenant();
    if (!tenant) throw new Error("Tenant context required");
    const contactsToUpdate = await repo.findByIds(tenant, ids);
    const toAdd = options.addTags?.map((t) => t.trim()).filter(Boolean) ?? [];
    const toRemove = new Set(
      options.removeTags?.map((t) => t.trim().toLowerCase()).filter(Boolean) ?? [],
    );

    const toSave: Contact[] = [];
    for (const c of contactsToUpdate) {
      if (c.deletedAt) continue;
      const currentTags = getContactTags(c);
      const tagSet = new Set(currentTags);
      let changed = false;

      for (let i = 0; i < toAdd.length; i++) {
        const tag = toAdd[i];
        if (!tagSet.has(tag)) {
          tagSet.add(tag);
          changed = true;
        }
      }
      for (const tag of tagSet) {
        if (toRemove.has(tag.toLowerCase())) {
          tagSet.delete(tag);
          changed = true;
        }
      }

      if (!changed) continue;

      const nextTags = [...tagSet];
      const tagStr = nextTags.length > 0 ? nextTags.join(", ") : undefined;
      const next: Contact = {
        ...c,
        tags: nextTags,
        tag: tagStr,
        updatedAt: new Date().toISOString(),
      };
      toSave.push(next);
    }
    if (toSave.length > 0) {
      await repo.bulkSave(tenant, toSave);
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
