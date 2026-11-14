import type { ObligationsRepository } from "../repository/obligationsRepository.js";
import { obligationsRepository } from "../repository/obligationsRepositoryAdapter.js";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { createGenericRelationalService } from "../../services/genericRelationalService.js";
import { upsertWithBroadcast } from "../../services/tenantBulkService.js";
import {
  dedupeTrimmedIds,
  type ObligationCollection,
  obligationCollectionListSchema,
  obligationCollectionRecordSchema,
} from "@mms/shared";
import { createObligationsCatalogUseCases } from "./obligationsCatalogUseCases.js";
import { createObligationsInsightUseCases } from "./obligationsInsightUseCases.js";
import { createObligationCollectionBulkService } from "./obligationCollectionServices.js";
import {
  archiveCollectionsWithLedger,
  loadCollectionsById,
  postCreatedCollection,
  postSavedCollection,
  restoreCollectionsWithLedger,
} from "./obligationLedgerSync.js";
import { assertReceiptHasWakala } from "../domain/obligationWriteGuards.js";
import { auditCollectionSaved } from "./obligationAuditTrail.js";
import { withTenant } from "../../db/tenant-context.js";
import { findObligationJournalEntry } from "../../accounting/ledgerPosting/obligationVoucherLookup.js";

/**
 * Obligations use-cases — composition root binding an
 * {@link ObligationsRepository} to every operation. Production uses the default
 * Drizzle-backed `obligationsUseCases`; tests can pass a fake repository to
 * exercise orchestration in isolation.
 */
export function createObligationsUseCases(repo: ObligationsRepository = obligationsRepository) {
  const catalogUseCases = createObligationsCatalogUseCases(repo);

  const collectionBulkService = createObligationCollectionBulkService(repo);

  /**
   * Rejects receipts whose type/representative pair has no wakala.
   *
   * The rule lived only in the browser's representative picker; without it the receipt saved and
   * the ledger credited 100 % to the default income account, turning a wakala liability into
   * income. One wakala read per write batch, not per receipt.
   */
  const guardReceipts = async (
    tenant: string,
    records: readonly ObligationCollection[],
  ): Promise<void> => {
    if (records.length === 0) return;
    const wakalas = await repo.listWakalaTypesByWorkspace(tenant);
    for (const record of records) {
      assertReceiptHasWakala(
        {
          obligation_type_id: record.obligation_type_id,
          mujtahid_representative_id: record.mujtahid_representative_id,
        },
        wakalas,
      );
    }
  };

  const collectionCrud = createGenericRelationalService<ObligationCollection>({
    repo: {
      listByWorkspace: repo.listObligationCollectionsByWorkspace,
      findById: repo.findObligationCollectionById,
      save: repo.saveObligationCollection,
      bulkDelete: repo.bulkSoftDeleteObligationCollections,
      bulkRestore: repo.bulkRestoreObligationCollections,
    },
    schema: obligationCollectionRecordSchema,
    websocketCollection: "obligation_collections",
    idPrefix: "oc",
  });

  return {
    ...catalogUseCases,

    replaceObligationCollections: collectionBulkService.replace,

    /**
     * The collections directory.
     *
     * Honours the query the endpoint actually declares (`includeDeleted`, `limit`, `offset`) instead
     * of accepting-and-dropping it: the generic `collectionCrud.loadAll` only reads `includeDeleted`,
     * so `?limit=10` used to return the whole list. The repository already supports all three.
     */
    loadObligationCollections: async (options?: {
      includeDeleted?: boolean;
      limit?: number;
      offset?: number;
    }): Promise<ObligationCollection[]> => {
      const tenant = getRequestTenant();
      if (!tenant) return [];
      return repo.listObligationCollectionsByWorkspace(tenant, {
        deleted: options?.includeDeleted ? "deleted" : "active",
        ...(options?.limit !== undefined ? { limit: options.limit } : {}),
        ...(options?.offset !== undefined ? { offset: options.offset } : {}),
      });
    },

    /**
     * Runs a module read inside the tenant transaction boundary.
     *
     * The contract router used to open `withTenant(..., { readOnly: true })` in the controller,
     * which put both the transaction boundary and the RLS context in the transport layer.
     */
    runObligationsRead: async <T>(operation: () => Promise<T>): Promise<T> => {
      const tenant = getRequestTenant();
      if (!tenant) return operation();
      return withTenant(tenant, operation, { readOnly: true });
    },

    /** The posted journal entry for a collection — the controller no longer reaches into accounting. */
    loadObligationCollectionVoucher: async (id: string) => {
      const tenant = getRequestTenant();
      const cleanId = id?.trim();
      if (!tenant || !cleanId) return null;
      return findObligationJournalEntry(tenant, cleanId);
    },
    loadObligationCollectionById: async (
      id: string,
      includeDeleted = false,
    ): Promise<ObligationCollection | null> => {
      const tenant = getRequestTenant();
      const cleanId = id?.trim();
      if (!tenant || !cleanId) return null;
      const col = await repo.findObligationCollectionById(tenant, cleanId);
      if (!col) return null;
      if (!includeDeleted && col.deletedAt) return null;
      if (includeDeleted && !col.deletedAt) return null;
      return col;
    },
    loadObligationCollectionsByIds: async (
      ids: string[],
      includeDeleted = false,
    ): Promise<ObligationCollection[]> => {
      const tenant = getRequestTenant();
      if (!tenant) return [];
      const cleanIds = dedupeTrimmedIds(ids);
      if (cleanIds.length === 0) return [];
      return repo.findObligationCollectionsByIds(tenant, cleanIds, { includeDeleted });
    },
    saveObligationCollection: async (record: ObligationCollection): Promise<void> => {
      const tenant = getRequestTenant();
      if (!tenant) return;
      await guardReceipts(tenant, [record]);
      const previous =
        (await loadCollectionsById(repo, tenant, [record.id])).get(record.id) ?? null;
      // The write and its audit row share one transaction: an audit append failure rolls the
      // receipt back (security audit A1), so no mutation can commit unlogged.
      await withTenant(tenant, async () => {
        await repo.saveObligationCollection(tenant, record);
        await auditCollectionSaved(tenant, previous, record);
        // Same transaction: a posting the ledger *rejects* (4xx) rolls the receipt back, so an
        // accepted amount can never disagree with the books (security audit A3).
        await postSavedCollection(tenant, record, previous);
      });
    },

    createObligationCollection: async (
      record: Parameters<typeof collectionCrud.create>[0],
    ): Promise<ObligationCollection> => {
      const requestTenant = getRequestTenant();
      if (requestTenant) await guardReceipts(requestTenant, [record as ObligationCollection]);
      if (!requestTenant) return collectionCrud.create(record);
      return withTenant(requestTenant, async () => {
        const row = await collectionCrud.create(record);
        await auditCollectionSaved(requestTenant, null, row);
        await postCreatedCollection(requestTenant, row);
        return row;
      });
    },

    updateObligationCollectionById: async (
      id: string,
      record: Partial<ObligationCollection>,
    ): Promise<ObligationCollection | null> => {
      const tenant = getRequestTenant();
      const previous = tenant
        ? ((await loadCollectionsById(repo, tenant, [id])).get(id) ?? null)
        : null;
      if (!tenant) return collectionCrud.updateById(id, record);
      return withTenant(tenant, async () => {
        const row = await collectionCrud.updateById(id, record);
        if (!row) return row;
        await auditCollectionSaved(tenant, previous, row);
        await postSavedCollection(tenant, row, previous);
        return row;
      });
    },

    upsertObligationCollections: async (
      records: ObligationCollection[],
    ): Promise<ObligationCollection[]> => {
      const tenant = getRequestTenant();
      if (tenant) await guardReceipts(tenant, records);
      // Read the pre-write rows first: after the upsert they would be the new
      // values, every edit would look unchanged, and the stale journal entry
      // would stay on the books.
      const previousById = tenant
        ? await loadCollectionsById(
            repo,
            tenant,
            records.map((record) => record.id),
          )
        : new Map<string, ObligationCollection>();
      const saved = await withTenant(tenant!, async () => {
        const written = await upsertWithBroadcast(
          obligationCollectionListSchema,
          records,
          repo.bulkSaveObligationCollections,
          "obligation_collections",
        );
        // One audit row and one ledger revision per receipt, inside the bulk write's transaction:
        // a posting the ledger rejects rolls the whole batch back.
        for (const record of written) {
          const previous = previousById.get(record.id) ?? null;
          await auditCollectionSaved(tenant!, previous, record);
          await postSavedCollection(tenant!, record, previous);
        }
        return written;
      });
      return saved;
    },

    /**
     * Archive + ledger reversal in one transaction (F13). A posting failure now rolls the archive
     * back and surfaces as an error instead of leaving an archived receipt with a live journal
     * entry and nothing but a log line recording it.
     */
    deleteObligationCollectionById: async (
      id: string,
      deletedBy: string = "system",
      reason?: string,
    ) => {
      const tenant = getRequestTenant();
      if (!tenant) return collectionCrud.deleteById(id, deletedBy, reason);
      return archiveCollectionsWithLedger(
        repo,
        tenant,
        [id],
        () => collectionCrud.deleteById(id, deletedBy, reason),
        { deletedBy, reason },
      );
    },

    restoreObligationCollectionById: async (id: string, userId?: string): Promise<boolean> => {
      const tenant = getRequestTenant();
      if (!tenant) return collectionCrud.restoreById(id, userId);
      return restoreCollectionsWithLedger(
        repo,
        tenant,
        [id],
        () => collectionCrud.restoreById(id, userId),
        { restoredBy: userId ?? null },
      );
    },

    bulkSoftDeleteObligationCollections: async (
      ids: string[],
      deletedBy: string = "system",
      reason?: string,
    ) => {
      const tenant = getRequestTenant();
      if (!tenant) return collectionCrud.bulkDeleteByIds(ids, deletedBy, reason);
      return archiveCollectionsWithLedger(
        repo,
        tenant,
        ids,
        () => collectionCrud.bulkDeleteByIds(ids, deletedBy, reason),
        { deletedBy, reason },
      );
    },

    bulkRestoreObligationCollections: async (
      ids: string[],
      userId?: string,
    ): Promise<{ succeeded: number; failed: number }> => {
      const tenant = getRequestTenant();
      if (!tenant) return collectionCrud.bulkRestoreByIds(ids, userId);
      return restoreCollectionsWithLedger(
        repo,
        tenant,
        ids,
        () => collectionCrud.bulkRestoreByIds(ids, userId),
        { restoredBy: userId ?? null },
      );
    },

    ...createObligationsInsightUseCases(repo),
  };
}

export const obligationsUseCases = createObligationsUseCases();
