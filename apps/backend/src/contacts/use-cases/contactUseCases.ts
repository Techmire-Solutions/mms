import type { ContactsRepository } from "../repository/contactsRepository.js";
import { contactsRepository } from "../repository/contactsRepositoryAdapter.js";
import * as loadUseCases from "./contactLoadUseCases.js";
import * as writeUseCases from "./contactWriteUseCases.js";
import * as softDeleteUseCases from "./contactSoftDeleteUseCases.js";
import * as validationUseCases from "./contactValidationUseCases.js";
import * as inferenceUseCases from "./contactInferenceUseCases.js";

// Barrel — raw functions keep the repository interface as a trailing DI param.
export * from "./contactLoadUseCases.js";
export * from "./contactWriteUseCases.js";
export * from "./contactSoftDeleteUseCases.js";
export * from "./contactValidationUseCases.js";
export * from "./contactInferenceUseCases.js";
export * from "./contactDuplicateScanUseCases.js";
export * from "./contactExportUseCases.js";
export * from "./contactGoogleSyncUseCases.js";
export * from "./contactSavedReportUseCases.js";

/**
 * Composition root — binds a `ContactsRepository` to every use case.
 *
 * Production uses the default Drizzle-backed `contactUseCases`; tests can pass a
 * fake repository to exercise use-case orchestration in isolation.
 */
export function createContactsUseCases(repo: ContactsRepository = contactsRepository) {
  return {
    countContacts: (options?: { includeDeleted?: boolean }) =>
      loadUseCases.countContacts(options, repo),
    loadContactsPage: (query: Parameters<typeof loadUseCases.loadContactsPage>[0]) =>
      loadUseCases.loadContactsPage(query, repo),
    loadContactsPageForTenant: (
      tenant: string,
      query: Parameters<typeof loadUseCases.loadContactsPageForTenant>[1],
    ) => loadUseCases.loadContactsPageForTenant(tenant, query, repo),
    loadContactsByIdsForTenant: (tenant: string, ids: string[]) =>
      loadUseCases.loadContactsByIdsForTenant(tenant, ids, repo),
    loadContactsSummaryByIdsForTenant: (tenant: string, ids: string[]) =>
      loadUseCases.loadContactsSummaryByIdsForTenant(tenant, ids, repo),
    loadContactsCommandMetrics: () => loadUseCases.loadContactsCommandMetrics(repo),
    loadContactRuntimeDefaults: () => loadUseCases.loadContactRuntimeDefaults(),
    loadContactsReportAnalytics: (
      options?: Parameters<typeof loadUseCases.loadContactsReportAnalytics>[0],
    ) => loadUseCases.loadContactsReportAnalytics(options, repo),
    loadContactsWidgetAggregates: (
      queries: Parameters<typeof loadUseCases.loadContactsWidgetAggregates>[0],
    ) => loadUseCases.loadContactsWidgetAggregates(queries, repo),
    loadContactsByIds: (ids: string[]) => loadUseCases.loadContactsByIds(ids, repo),
    loadExistingNormalizedContactNames: (names: string[]) =>
      loadUseCases.loadExistingNormalizedContactNames(names, repo),
    findContactsMatchingUniqueValues: (
      values: Parameters<typeof loadUseCases.findContactsMatchingUniqueValues>[0],
      excludeIds?: Parameters<typeof loadUseCases.findContactsMatchingUniqueValues>[1],
    ) => loadUseCases.findContactsMatchingUniqueValues(values, excludeIds, repo),
    loadContactDuplicatePairsPage: (query: { page?: number; limit?: number }) =>
      loadUseCases.loadContactDuplicatePairsPage(query, repo),
    getContactById: (id: string, includeDeleted?: boolean) =>
      loadUseCases.getContactById(id, includeDeleted, repo),
    upsertContact: (
      contact: Parameters<typeof writeUseCases.upsertContact>[0],
      options?: Parameters<typeof writeUseCases.upsertContact>[1],
    ) => writeUseCases.upsertContact(contact, options, repo),
    updateContactById: (
      id: string,
      contact: Parameters<typeof writeUseCases.updateContactById>[1],
      languageOrOptions?: Parameters<typeof writeUseCases.updateContactById>[2],
    ) => writeUseCases.updateContactById(id, contact, languageOrOptions, repo),
    mergeContactsById: (
      keepId: string,
      deleteId: string,
      mergedInput: Parameters<typeof writeUseCases.mergeContactsById>[2],
      deletedBy: string,
    ) => writeUseCases.mergeContactsById(keepId, deleteId, mergedInput, deletedBy, repo),
    bulkSaveContacts: (contacts: Parameters<typeof writeUseCases.bulkSaveContacts>[0]) =>
      writeUseCases.bulkSaveContacts(contacts, repo),
    bulkTagContacts: (
      ids: string[],
      options: Parameters<typeof writeUseCases.bulkTagContacts>[1],
    ) => writeUseCases.bulkTagContacts(ids, options, repo),
    restoreContactById: (id: string, userId?: string) =>
      softDeleteUseCases.restoreContactById(id, userId, repo),
    bulkRestoreContacts: (ids: string[], userId?: string) =>
      softDeleteUseCases.bulkRestoreContacts(ids, userId, repo),
    softDeleteContactById: (id: string, deletedBy: string, deletionReason?: string) =>
      softDeleteUseCases.softDeleteContactById(id, deletedBy, deletionReason, repo),
    bulkSoftDeleteContacts: (ids: string[], deletedBy: string, deletionReason?: string) =>
      softDeleteUseCases.bulkSoftDeleteContacts(ids, deletedBy, deletionReason, repo),
    matchContactIdentityIndex: (
      candidates: Parameters<typeof inferenceUseCases.matchContactIdentityIndex>[0],
    ) => inferenceUseCases.matchContactIdentityIndex(candidates, repo),
    assertContactUniqueFields: (
      tenant: string,
      contact: Parameters<typeof validationUseCases.assertContactUniqueFields>[1],
      languageOrOptions?: Parameters<typeof validationUseCases.assertContactUniqueFields>[2],
      excludeContactIdsArg?: Parameters<typeof validationUseCases.assertContactUniqueFields>[3],
    ) =>
      validationUseCases.assertContactUniqueFields(
        tenant,
        contact,
        languageOrOptions,
        excludeContactIdsArg,
        repo,
      ),
  };
}

type ContactsUseCases = ReturnType<typeof createContactsUseCases>;

/** Default Drizzle-backed use-case instance used by routes and cross-module services. */
export const contactUseCases: ContactsUseCases = createContactsUseCases();
