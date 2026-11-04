import {
  resolveRelationshipPairs,
  resolveInverseRelationship,
  type Contact,
  type ContactRelationship,
  type RelationshipContact,
  type RelationshipPair,
  type PlannedRelationship,
  type RelationshipLink,
} from "@mms/shared";
import { logger } from "../../lib/logger.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import { loadContactPreferences } from "./contactPreferencesService.js";
import type { ContactsRepository } from "../repository/contactsRepository.js";
import { contactsRepository } from "../repository/contactsRepositoryAdapter.js";

function linksForContact(contact: Contact): RelationshipLink[] {
  const collect = (entry: RelationshipContact | ContactRelationship): RelationshipLink | null => {
    const contactId = entry.contactId == null ? "" : String(entry.contactId);
    if (!contactId.trim()) return null;
    return {
      contactId,
      relationship: entry.relationship,
      inferred: "inferred" in entry && entry.inferred === true,
    };
  };

  return [...(contact.relationshipContacts ?? []), ...(contact.relationships ?? [])]
    .map(collect)
    .filter((entry): entry is RelationshipLink => Boolean(entry));
}

function setInferredRelationshipContact(
  contact: Contact,
  planned: PlannedRelationship,
): Contact | null {
  const relationshipContacts = contact.relationshipContacts ?? [];
  const existingIndex = relationshipContacts.findIndex(
    (entry) => String(entry.contactId) === planned.contactId,
  );
  if (existingIndex >= 0 && relationshipContacts[existingIndex]?.inferred !== true) {
    // A user-authored link always wins: never relabel it or flip it to inferred.
    return null;
  }
  const relationshipEntry: RelationshipContact = {
    contactId: planned.contactId,
    relationship: planned.relationship,
    inferred: true,
    inferredFromContactId: planned.inferredFromContactId,
    inferenceDepth: planned.inferenceDepth,
  };
  const nextRelationshipContacts =
    existingIndex >= 0
      ? relationshipContacts.map((entry, index) =>
          index === existingIndex ? { ...entry, ...relationshipEntry } : entry,
        )
      : [...relationshipContacts, relationshipEntry];

  return {
    ...contact,
    relationshipContacts: nextRelationshipContacts,
  };
}

/**
 * Drops inferred links owned by `sourceId` that no longer correspond to a current
 * source link, so unlinking does not leave phantom relatives behind.
 */
function removeStaleInferredLinks(
  contact: Contact,
  sourceId: string,
  keepContactIds: ReadonlySet<string>,
): Contact {
  const current = contact.relationshipContacts ?? [];
  const next = current.filter(
    (entry) =>
      !(
        entry.inferred === true &&
        String(entry.inferredFromContactId ?? "") === sourceId &&
        !keepContactIds.has(String(entry.contactId))
      ),
  );
  return next.length === current.length ? contact : { ...contact, relationshipContacts: next };
}

export interface ContactRelationshipInferenceOptions {
  /** Acting user — stamped on inferred target rows and the inference audit event. */
  actorId?: string;
  /**
   * The source contact as stored before this write. Its links identify targets
   * whose inferred reciprocal row must be removed when a link is dropped.
   */
  previousSource?: Contact;
}

/**
 * Writes reciprocal relationship links from tenant-configured pairs only.
 * No hardcoded family-role graph or depth-2/3 inference.
 *
 * Manual links are never relabelled, stale inferred links are removed, and each
 * target is written with the same `updated_at` predicate as interactive saves so
 * a concurrent edit cannot be reverted silently.
 */
export async function applyContactRelationshipInference(
  tenant: string,
  sourceContact: Contact,
  customPairs?: RelationshipPair[],
  repo: ContactsRepository = contactsRepository,
  options?: ContactRelationshipInferenceOptions,
): Promise<void> {
  const sourceId = String(sourceContact.id);
  const sourceLinks = linksForContact(sourceContact).filter(
    (entry) => entry.contactId !== sourceId,
  );
  // Inferred rows live on the *target* contact, so cleanup must also load the
  // targets that were linked before this write — including when the source now
  // has no links at all.
  const previousTargetIds = options?.previousSource
    ? linksForContact(options.previousSource)
        .map((entry) => entry.contactId)
        .filter((id) => id !== sourceId)
    : [];
  const firstIds = Array.from(
    new Set([...sourceLinks.map((entry) => entry.contactId), ...previousTargetIds]),
  ).filter((id) => id !== sourceId);
  if (sourceLinks.length === 0 && firstIds.length === 0) return;

  const resolvedPairs =
    sourceLinks.length > 0
      ? customPairs && customPairs.length > 0
        ? customPairs
        : resolveRelationshipPairs((await loadContactPreferences())?.relationshipPairs)
      : [];

  const firstContacts = firstIds.length > 0 ? await repo.findByIds(tenant, firstIds) : [];
  const contactsById = new Map<string, Contact>([
    [sourceId, sourceContact],
    ...firstContacts.map((contact) => [String(contact.id), contact] as const),
  ]);
  const planned = new Map<string, PlannedRelationship>();

  for (const sourceLink of sourceLinks) {
    const target = contactsById.get(sourceLink.contactId);
    if (!target || target.deletedAt) continue;

    const reciprocalLabel = resolveInverseRelationship(
      sourceLink.relationship ?? "",
      sourceContact,
      resolvedPairs,
    );
    if (!reciprocalLabel) continue;

    planned.set(`${sourceLink.contactId}:${sourceId}`, {
      ownerId: sourceLink.contactId,
      contactId: sourceId,
      relationship: reciprocalLabel,
      inferredFromContactId: sourceId,
      inferenceDepth: 1,
    });
  }

  const keepByOwner = new Map<string, Set<string>>();
  for (const relationship of planned.values()) {
    const keep = keepByOwner.get(relationship.ownerId) ?? new Set<string>();
    keep.add(relationship.contactId);
    keepByOwner.set(relationship.ownerId, keep);
  }

  const updatesById = new Map<string, Contact>();
  // Clean every loaded target: a removed source link must drop the reciprocal
  // inferred row even when the target is no longer referenced by this contact.
  for (const target of firstContacts) {
    if (target.deletedAt) continue;
    const ownerId = String(target.id);
    const cleaned = removeStaleInferredLinks(
      target,
      sourceId,
      keepByOwner.get(ownerId) ?? new Set(),
    );
    if (cleaned !== target) updatesById.set(ownerId, cleaned);
  }

  for (const relationship of planned.values()) {
    const owner = updatesById.get(relationship.ownerId) ?? contactsById.get(relationship.ownerId);
    if (!owner || owner.deletedAt) continue;
    const next = setInferredRelationshipContact(owner, relationship);
    // `null` means a user-authored link already owns this pair — leave it alone.
    if (next) updatesById.set(relationship.ownerId, next);
  }

  const savedIds: string[] = [];
  const skippedIds: string[] = [];
  const fallbackUpdates: Contact[] = [];
  for (const [ownerId, update] of updatesById) {
    const original = contactsById.get(ownerId);
    if (!original) continue;
    const next = options?.actorId ? { ...update, updatedBy: options.actorId } : update;
    let saved: string | null;
    if (original.updatedAt && typeof repo.saveIfVersionMatches === "function") {
      saved = await repo.saveIfVersionMatches(tenant, next, String(original.updatedAt));
    } else if (typeof repo.save === "function") {
      saved = await repo.save(tenant, next);
    } else {
      // Minimal test doubles may only implement `bulkSave`; batch those below.
      fallbackUpdates.push(next);
      savedIds.push(ownerId);
      continue;
    }
    if (saved) {
      savedIds.push(ownerId);
    } else {
      skippedIds.push(ownerId);
      logger.warn(
        { tenant, sourceId, ownerId },
        "Relationship inference skipped: target changed concurrently",
      );
    }
  }
  if (fallbackUpdates.length > 0 && typeof repo.bulkSave === "function") {
    await repo.bulkSave(tenant, fallbackUpdates);
  }

  if (options?.actorId && (savedIds.length > 0 || skippedIds.length > 0)) {
    await recordModernAuditEvent({
      workspaceSubdomain: tenant,
      tableName: "contacts",
      recordId: sourceId,
      actionType: "UPDATE",
      realUserId: options.actorId,
      subjectId: sourceId,
      newState: {
        action: "contact.relationship_inference",
        summary: `Inferred ${savedIds.length} reciprocal link(s)${
          skippedIds.length > 0 ? `; skipped ${skippedIds.length} concurrent edit(s)` : ""
        }`,
        savedTargetIds: savedIds,
        skippedTargetIds: skippedIds,
      },
    }).catch((error: unknown) => {
      logger.error(
        { err: error instanceof Error ? error.message : String(error), tenant, sourceId },
        "Relationship inference audit append failed",
      );
    });
  }
}
