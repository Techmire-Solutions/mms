import { sql } from "drizzle-orm";
import {
  countContactsByWorkspace,
  getLatestContactWriteAt,
  findContactById,
  findContactsByIds,
  findContactsSummaryByIds,
  saveContact,
  saveContactIfVersionMatches,
  bulkSaveContacts,
  bulkSoftDeleteContactsSql,
  findExistingNormalizedContactNames,
  findActiveContactsMatchingUniqueValues,
  findContactDuplicateCandidateIds,
  findContactDuplicateBlockedIds,
  findContactGuardianIds,
  reparentContactReferences,
  replaceContactTags,
  listContactsPage,
  isContactAttachmentReferenced,
} from "./contactRepository.js";
import {
  aggregateContactsCommandMetrics,
  aggregateContactsReportAnalytics,
  aggregateContactsMonthlyCreatedCounts,
  aggregateContactsWidgetQueries,
} from "./contactRepositoryAggregates.js";
import { withTenant } from "@mms/db/context";
import {
  findContactDeleteBlockers,
  guardContactSoftDeleteDependents,
} from "./contactDeleteGuards.js";
import type { ContactsRepository } from "./contactsRepository.js";

/**
 * Drizzle adapter for `ContactsRepository`.
 *
 * Delegates to the existing tenant-scoped Drizzle repository functions; the
 * interface is the contract use cases depend on (SSOT storage gateway).
 */
function createContactsRepository(): ContactsRepository {
  return {
    countByWorkspace: (tenant, options) => countContactsByWorkspace(tenant, options),
    getLatestWriteAt: (tenant) => getLatestContactWriteAt(tenant),
    listPage: (tenant, query) => listContactsPage(tenant, query),
    findById: (tenant, id, options) =>
      options ? findContactById(tenant, id, options) : findContactById(tenant, id),
    findByIds: (tenant, ids, options) =>
      options ? findContactsByIds(tenant, ids, options) : findContactsByIds(tenant, ids),
    findSummaryByIds: (tenant, ids) => findContactsSummaryByIds(tenant, ids),
    save: (tenant, contact) => saveContact(tenant, contact),
    saveIfVersionMatches: (tenant, contact, expectedUpdatedAt) =>
      saveContactIfVersionMatches(tenant, contact, expectedUpdatedAt),
    replaceContactTags: (tenant, updates, updatedBy) =>
      replaceContactTags(tenant, updates, updatedBy),
    bulkSave: (tenant, contacts) => bulkSaveContacts(tenant, contacts),
    bulkSoftDelete: (tenant, ids, deletedBy, deletionReason) =>
      bulkSoftDeleteContactsSql(tenant, ids, deletedBy, deletionReason),
    findExistingNormalizedContactNames: (tenant, names) =>
      findExistingNormalizedContactNames(tenant, names),
    findActiveContactsMatchingUniqueValues: (tenant, values, excludeIds) =>
      findActiveContactsMatchingUniqueValues(tenant, values, excludeIds),
    findContactDuplicateCandidateIds: (tenant, keys, excludeIds) =>
      findContactDuplicateCandidateIds(tenant, keys, excludeIds),
    findContactDuplicateBlockedIds: (tenant, namePrefixes) =>
      findContactDuplicateBlockedIds(tenant, namePrefixes),
    findContactGuardianIds: (tenant, ids) => findContactGuardianIds(tenant, ids),
    reparentContactReferences: (tenant, keepId, deleteId, actorId) =>
      reparentContactReferences(tenant, keepId, deleteId, actorId),
    acquireUniqueValueLocks: async (tenant, lockKeys) => {
      if (lockKeys.length === 0) return;
      const subdomain = tenant.trim().toLowerCase();
      const sorted = [...new Set(lockKeys.map((key) => key.trim()).filter(Boolean))].sort();
      await withTenant(subdomain, async (tx) => {
        for (const key of sorted) {
          await tx.execute(
            sql`SELECT pg_advisory_xact_lock(hashtext(${subdomain}), hashtext(${key}))`,
          );
        }
      });
    },
    aggregateCommandMetrics: (tenant, fieldConfig, options) =>
      aggregateContactsCommandMetrics(tenant, fieldConfig, options),
    aggregateReportAnalytics: (tenant, options) =>
      aggregateContactsReportAnalytics(tenant, options),
    aggregateMonthlyCreatedCounts: (tenant, years, monthCount, language) =>
      aggregateContactsMonthlyCreatedCounts(tenant, years, monthCount, language),
    aggregateWidgetQueries: (tenant, queries) => aggregateContactsWidgetQueries(tenant, queries),
    guardDeleteDependents: (tenant, ids) => guardContactSoftDeleteDependents(tenant, ids),
    findDeleteBlockers: (tenant, ids) => findContactDeleteBlockers(tenant, ids),
    isAttachmentReferenced: (tenant, url, alternateUrl) =>
      isContactAttachmentReferenced(tenant, url, alternateUrl),
  };
}

/** Active repository binding (Drizzle by default; overridable in tests). */
let activeRepository: ContactsRepository = createContactsRepository();

/**
 * Default instance used by the production use-case layer. Delegates through a
 * proxy so tests can swap the backing repository without rewriting every
 * use-case's default parameter.
 */
export const contactsRepository: ContactsRepository = new Proxy({} as ContactsRepository, {
  get: (_target, property) =>
    (activeRepository as unknown as Record<PropertyKey, unknown>)[property],
});

/** Test-only: point the adapter at a fake repository. */
export function setContactsRepositoryForTesting(repository: ContactsRepository): void {
  activeRepository = repository;
}

/** Test-only: restore the Drizzle-backed repository. */
export function resetContactsRepositoryForTesting(): void {
  activeRepository = createContactsRepository();
}
