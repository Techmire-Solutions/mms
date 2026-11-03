import { type Contact, type User } from "@mms/shared";
import { invalidateDuplicateScanCache } from "./contactDuplicateScanUseCases.js";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { applyContactRelationshipInference } from "./contactInferenceUseCases.js";
import { assertContactAttachmentUrls } from "./contactAttachmentUrls.js";
import { runInTransaction } from "../../db/database.js";
import { canDeleteContacts } from "../../lib/rbacCanHelpers.js";
import { ConflictError, ValidationError } from "../../lib/httpErrors.js";
import {
  assertContactUniqueFields,
  ContactPermissionError,
  mergeContactPatch,
  prepareContactRecord,
  stripClientSoftDeleteFields,
} from "./contactValidationUseCases.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { invalidateMultiTierCache } from "../../lib/cache/index.js";
import { loadContactWriteContext } from "./contactWriteContext.js";
import { collectRelatedContactIds } from "./contactRelationshipIds.js";
import { reconcileContactSystemTags } from "../systemTags/contactSystemTagUseCases.js";
import type { ContactWriteContext } from "./contactWriteContextTypes.js";
import type { ContactsRepository } from "../repository/contactsRepository.js";
import { contactsRepository } from "../repository/contactsRepositoryAdapter.js";

interface UpsertContactOptions {
  user?: User;
  canRestore?: boolean;
  /** Accept-Language for unique-field conflict messages. */
  language?: string;
  /** Acting user when no full `User` is available (queued import worker). */
  actorId?: string;
  /** Preloaded tenant config (batch writers) — avoids re-reading it per contact. */
  context?: ContactWriteContext;
  /**
   * Batch mode: skip per-record live-update broadcast, multi-tier cache
   * invalidation and duplicate-scan invalidation. The caller must run each
   * exactly once after the batch.
   */
  batchMode?: boolean;
}

export async function upsertContact(
  contact: Contact,
  options?: User | UpsertContactOptions,
  repo: ContactsRepository = contactsRepository,
): Promise<{
  contact: Contact;
  created: boolean;
  restoredFromDelete?: boolean;
}> {
  const opts = options && !("role" in options) ? (options as UpsertContactOptions) : undefined;
  // Load tenant config before the write transaction: it is read-only and does
  // not belong inside the row-locked scope.
  const context = opts?.context ?? (await loadContactWriteContext());
  const result = await runInTransaction(async () => {
    const tenant = getRequestTenant();
    if (!tenant) throw new Error("Tenant context required");
    // Include trashed rows: an upsert that revives an archived contact must see
    // it (and stamp restore provenance) instead of creating a duplicate.
    const existing = await repo.findById(tenant, String(contact.id ?? ""), {
      includeDeleted: true,
    });
    const created = !existing;
    const restoredFromDelete = existing && Boolean(existing.deletedAt);

    const user = options && "role" in options ? (options as User) : opts?.user;
    const explicitCanRestore = opts?.canRestore;
    const language = opts?.language || "en";
    const actorId = user?.id != null ? String(user.id) : opts?.actorId;

    if (restoredFromDelete) {
      if (explicitCanRestore === false) {
        throw new ContactPermissionError(
          "Restoring soft-deleted contacts requires delete permissions",
        );
      }
      if (user && !canDeleteContacts(user)) {
        throw new ContactPermissionError(
          "Restoring soft-deleted contacts requires delete permissions",
        );
      }
    }

    const stripped = stripClientSoftDeleteFields(contact);
    const mergedInput = existing ? mergeContactPatch(existing, stripped) : stripped;
    const contactWithId = await prepareContactRecord(
      mergedInput,
      contact.id ?? existing?.id,
      context,
    );
    assertContactAttachmentUrls(
      contactWithId,
      tenant,
      (existing?.attachments ?? []).map((attachment) => attachment.url),
    );
    await assertContactUniqueFields(tenant, contactWithId, { language, context }, [], repo);
    const saved: Contact = created
      ? contactWithId
      : {
          ...contactWithId,
          deletedAt: undefined,
          deletedBy: undefined,
          deletionReason: undefined,
        };
    // Audit attribution is stamped from the session, never from the payload.
    if (actorId) {
      saved.createdBy = existing?.createdBy ?? actorId;
      saved.updatedBy = actorId;
    }
    if (restoredFromDelete) {
      // Restore provenance belongs to the delete sextuple — an upsert that
      // resurrects a trashed contact must record who did it and when.
      saved.restoredAt = new Date().toISOString();
      saved.restoredBy = actorId ?? existing?.restoredBy;
    }

    await repo.save(tenant, saved);
    await applyContactRelationshipInference(tenant, saved, undefined, repo, {
      actorId,
      previousSource: existing ?? undefined,
    });
    // Relationship edits can add/remove Student/Parent/Guardian roles; the
    // reconcile expands to related contacts, and removed links are included
    // explicitly so their archived tag is written. Batch writers skip the
    // per-row role probe (their bulk path preserves system tags).
    if (!opts?.batchMode) {
      await reconcileContactSystemTags(
        tenant,
        [String(saved.id), ...collectRelatedContactIds(existing ?? undefined, saved)],
        { actorId },
      );
    }
    if (!opts?.batchMode) {
      await invalidateDuplicateScanCache();
    }
    return { contact: saved, created, restoredFromDelete: restoredFromDelete || undefined };
  });
  const tenant = getRequestTenant();
  if (!opts?.batchMode) {
    if (tenant) {
      await invalidateMultiTierCache({ tenantId: tenant, domain: "contacts" });
    }
    await broadcastCollection("contacts");
  }
  return result;
}

interface UpdateContactByIdOptions {
  language?: string;
  /**
   * When false, skip peer relationship graph writes.
   * Required for self-service profile updates without `contacts.write`.
   * @default true
   */
  applyRelationshipInference?: boolean;
  /** Acting user — stamped into `updated_by`; never taken from the payload. */
  actorId?: string;
  /**
   * Optimistic concurrency: the `updatedAt` the client based its edit on.
   * A mismatch means another writer saved first → `ConflictError` (409).
   */
  expectedUpdatedAt?: string;
  /** Preloaded tenant config (batch writers). */
  context?: ContactWriteContext;
}

export async function updateContactById(
  id: string,
  contact: Contact,
  languageOrOptions: string | UpdateContactByIdOptions = "en",
  repo: ContactsRepository = contactsRepository,
): Promise<Contact | null> {
  const options: UpdateContactByIdOptions =
    typeof languageOrOptions === "string" ? { language: languageOrOptions } : languageOrOptions;
  const language = options.language ?? "en";
  const applyInference = options.applyRelationshipInference !== false;
  const actorId = options.actorId;
  const expectedUpdatedAt = options.expectedUpdatedAt?.trim();
  if (expectedUpdatedAt && Number.isNaN(Date.parse(expectedUpdatedAt))) {
    throw new ValidationError("Invalid x-expected-updated-at header");
  }
  const context = options.context ?? (await loadContactWriteContext());

  const saved = await runInTransaction(async () => {
    const tenant = getRequestTenant();
    if (!tenant) return null;
    const existing = await repo.findById(tenant, id);
    if (!existing || existing.deletedAt) {
      return null;
    }
    if (expectedUpdatedAt && existing.updatedAt && existing.updatedAt !== expectedUpdatedAt) {
      throw new ConflictError("This contact was changed by someone else. Reload it and try again.");
    }
    const stripped = stripClientSoftDeleteFields({ ...contact, id });
    const contactWithId = await prepareContactRecord(
      mergeContactPatch(existing, stripped),
      id,
      context,
    );
    assertContactAttachmentUrls(
      contactWithId,
      tenant,
      (existing.attachments ?? []).map((attachment) => attachment.url),
    );
    await assertContactUniqueFields(tenant, contactWithId, { language, context }, [], repo);
    const next: Contact = {
      ...contactWithId,
      id,
      createdBy: existing.createdBy,
      updatedBy: actorId ?? existing.updatedBy,
      deletedAt: existing.deletedAt,
      deletedBy: existing.deletedBy,
      deletionReason: existing.deletionReason,
    };
    if (expectedUpdatedAt) {
      // The version predicate lives in the UPDATE itself, so a writer that
      // commits after our read cannot be silently overwritten (C-01).
      const savedWithVersion = await repo.saveIfVersionMatches(tenant, next, expectedUpdatedAt);
      if (!savedWithVersion) {
        throw new ConflictError(
          "This contact was changed by someone else. Reload it and try again.",
        );
      }
    } else {
      await repo.save(tenant, next);
    }
    if (applyInference) {
      await applyContactRelationshipInference(tenant, next, undefined, repo, {
        actorId,
        previousSource: existing,
      });
    }
    await reconcileContactSystemTags(
      tenant,
      [String(next.id), ...collectRelatedContactIds(existing, next)],
      { actorId },
    );
    await invalidateDuplicateScanCache();
    return next;
  });
  if (saved) {
    const tenant = getRequestTenant();
    if (tenant) {
      await invalidateMultiTierCache({ tenantId: tenant, domain: "contacts" });
    }
    await broadcastCollection("contacts");
  }
  return saved;
}

export {
  mergeContactsById,
  bulkSaveContacts,
  bulkTagContacts,
} from "./contactBulkWriteUseCases.js";
