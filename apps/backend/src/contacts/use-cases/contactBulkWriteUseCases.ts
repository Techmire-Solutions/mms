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
import {
  assertContactUniqueFields,
  mergeContactPatch,
  prepareContactRecord,
  validateContactDynamic,
} from "./contactValidationUseCases.js";
import { stripUnreadableContactWriteKeys } from "./contactViewerWriteGuard.js";
import { assertContactAttachmentUrls } from "./contactAttachmentUrls.js";
import { loadContactWriteContext } from "./contactWriteContext.js";
import { loadPreviousRelationshipTargets } from "./contactRelationshipIds.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { invalidateMultiTierCache } from "../../lib/cache/index.js";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/httpErrors.js";
import { auditContactBulkTagged, auditContactMerged } from "./contactWriteAudit.js";
import type { ContactsRepository } from "../repository/contactsRepository.js";
import { contactsRepository } from "../repository/contactsRepositoryAdapter.js";

const CONTACT_VERSION_CONFLICT =
  "This contact was changed by someone else. Reload it and try again.";

export interface MergeContactsOptions {
  /** Acting role — its unreadable tabs are never written by the merge (R4-03). */
  viewerRole?: string;
  /** `updatedAt` of the surviving contact the caller decided to merge on (R4-05). */
  expectedKeepUpdatedAt?: string;
}

export async function mergeContactsById(
  keepId: string,
  deleteId: string,
  mergedInput: Contact | undefined,
  deletedBy: string,
  repo: ContactsRepository = contactsRepository,
  options: MergeContactsOptions = {},
): Promise<Contact> {
  const context = await loadContactWriteContext();
  const expectedKeepUpdatedAt = options.expectedKeepUpdatedAt?.trim();
  if (expectedKeepUpdatedAt && Number.isNaN(Date.parse(expectedKeepUpdatedAt))) {
    throw new ValidationError("Invalid x-expected-updated-at header");
  }
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
    // Merge is a whole-row write of the survivor: reject a stale snapshot instead
    // of silently reverting an edit committed since the client opened the preview.
    if (expectedKeepUpdatedAt && keep.updatedAt && keep.updatedAt !== expectedKeepUpdatedAt) {
      throw new ConflictError(CONTACT_VERSION_CONFLICT);
    }

    // `merged` is a patch, not a replacement: a field the client omitted (or a
    // collection the role cannot read) keeps the survivor's value.
    const viewerSafeInput = mergedInput
      ? stripUnreadableContactWriteKeys(mergedInput, options.viewerRole, context.fieldConfig)
      : undefined;
    const mergedSource = viewerSafeInput
      ? mergeContactPatch(keep, { ...viewerSafeInput, id: keepId })
      : mergeContactRecords(keep, other);
    // The survivor is a full-row write: enforce Setup's required fields/tabs and
    // the optional blueprint version lock before it replaces the stored record.
    await validateContactDynamic(tenant, mergedSource, {
      language: "en",
      viewerRole: options.viewerRole,
      fieldConfig: context.fieldConfig,
    });
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

    const now = new Date().toISOString();
    // Archive the merged-away row FIRST. The survivor may inherit a
    // workspace-unique value from it (e.g. `cnic`), and that partial unique
    // index only covers active rows — saving the survivor first aborts the
    // merge with a false 400 "duplicate CNIC".
    await repo.save(tenant, {
      ...other,
      deletedAt: now,
      deletedBy,
      deletionReason: `Merged into ${keepId}`,
      updatedAt: now,
    });

    if (expectedKeepUpdatedAt) {
      // Same predicate-in-the-UPDATE guarantee as the interactive edit path.
      const savedUpdatedAt = await repo.saveIfVersionMatches(tenant, next, expectedKeepUpdatedAt);
      if (!savedUpdatedAt) throw new ConflictError(CONTACT_VERSION_CONFLICT);
      next.updatedAt = savedUpdatedAt;
    } else {
      next.updatedAt = await repo.save(tenant, next);
    }
    await applyContactRelationshipInference(tenant, next, undefined, repo, {
      actorId: deletedBy,
      previousSource: keep,
    });

    await repo.reparentContactReferences(tenant, keepId, deleteId, deletedBy);
    // Merge is not a role end: the merged-away contact's system rows go away,
    // while the surviving contact inherits the reconciled roles.
    await removeSystemTagsForContacts(tenant, [deleteId]);
    await reconcileContactSystemTags(tenant, [keepId], {
      actorId: deletedBy,
    });

    // The destructive half of a merge must be audited atomically with it: the
    // route summary alone can be lost if the process dies after commit.
    await auditContactMerged({
      tenant,
      keepId: String(keepId),
      deleteId: String(deleteId),
      actorId: deletedBy,
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
  const ids = contacts
    .map((contact) => contact.id)
    .filter((id): id is string | number => id != null)
    .map(String);
  // Bulk save replaces the child graph, so removed relationship links must be
  // reconciled too: read the prior targets before the write.
  const previousTargets = await loadPreviousRelationshipTargets(repo, tenant, ids);
  await repo.bulkSave(tenant, contacts);
  if (ids.length > 0) {
    await reconcileContactSystemTags(tenant, [...ids, ...previousTargets]);
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
      // Audit each changed record inside the write transaction (bulk delete/restore
      // do the same); the route-level summary row is not the authoritative record.
      const previousById = new Map(contactsToUpdate.map((c) => [String(c.id), c]));
      for (const contact of toSave) {
        const previousTags = filterManualContactTags(
          getContactTags(previousById.get(String(contact.id)) ?? contact),
        );
        const previousLower = new Set(previousTags.map((tag) => tag.toLowerCase()));
        const nextTags = filterManualContactTags(contact.tags ?? []);
        const nextLower = new Set(nextTags.map((tag) => tag.toLowerCase()));
        await auditContactBulkTagged({
          tenant,
          contactId: String(contact.id),
          actorId: options.actorId,
          addedTags: nextTags.filter((tag) => !previousLower.has(tag.toLowerCase())),
          removedTags: previousTags.filter((tag) => !nextLower.has(tag.toLowerCase())),
        });
      }
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
