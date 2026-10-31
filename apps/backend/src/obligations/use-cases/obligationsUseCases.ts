import type { ObligationsRepository } from "../repository/obligationsRepository.js";
import { obligationsRepository } from "../repository/obligationsRepositoryAdapter.js";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { createGenericRelationalService } from "../../services/genericRelationalService.js";
import {
  defineTenantBulkCollectionService,
  upsertWithBroadcast,
} from "../../services/tenantBulkService.js";
import {
  dedupeTrimmedIds,
  type ObligationCollection,
  type ObligationsCommandMetricsSnapshot,
  type ObligationsReportAggregates,
  type ObligationsReportQuery,
  obligationCollectionListSchema,
  obligationCollectionRecordSchema,
} from "@mms/shared";
import { createObligationsCatalogUseCases } from "./obligationsCatalogUseCases.js";
import {
  loadCollectionsById,
  postArchivedCollections,
  postCreatedCollection,
  postRestoredCollections,
  postSavedCollection,
  snapshotArchivedCollections,
} from "./obligationLedgerSync.js";

const EMPTY_OBLIGATIONS_METRICS: ObligationsCommandMetricsSnapshot = {
  total: 0,
  totalAmount: 0,
  cash: 0,
  online: 0,
  newThisPeriod: 0,
  obligationTypes: 0,
};

/**
 * Obligations use-cases — composition root binding an
 * {@link ObligationsRepository} to every operation. Production uses the default
 * Drizzle-backed `obligationsUseCases`; tests can pass a fake repository to
 * exercise orchestration in isolation.
 */
export function createObligationsUseCases(repo: ObligationsRepository = obligationsRepository) {
  const catalogUseCases = createObligationsCatalogUseCases(repo);

  const collectionBulkService = defineTenantBulkCollectionService<ObligationCollection>(
    {
      listByWorkspace: repo.listObligationCollectionsByWorkspace,
      replaceForWorkspace: repo.replaceObligationCollectionsForWorkspace,
    },
    obligationCollectionListSchema,
    "obligation_collections",
  );

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

    loadObligationCollections: collectionCrud.loadAll,
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
      const previous =
        (await loadCollectionsById(repo, tenant, [record.id])).get(record.id) ?? null;
      await repo.saveObligationCollection(tenant, record);
      await postSavedCollection(tenant, record, previous);
    },

    createObligationCollection: async (
      record: Parameters<typeof collectionCrud.create>[0],
    ): Promise<ObligationCollection> => {
      const created = await collectionCrud.create(record);
      const tenant = getRequestTenant();
      if (tenant && created) await postCreatedCollection(tenant, created);
      return created;
    },

    updateObligationCollectionById: async (
      id: string,
      record: Partial<ObligationCollection>,
    ): Promise<ObligationCollection | null> => {
      const tenant = getRequestTenant();
      const previous = tenant
        ? ((await loadCollectionsById(repo, tenant, [id])).get(id) ?? null)
        : null;
      const updated = await collectionCrud.updateById(id, record);
      if (tenant && updated) await postSavedCollection(tenant, updated, previous);
      return updated;
    },

    upsertObligationCollections: async (
      records: ObligationCollection[],
    ): Promise<ObligationCollection[]> => {
      const tenant = getRequestTenant();
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
      const saved = await upsertWithBroadcast(
        obligationCollectionListSchema,
        records,
        repo.bulkSaveObligationCollections,
        "obligation_collections",
      );
      if (!tenant) return saved;
      for (const record of saved) {
        await postSavedCollection(tenant, record, previousById.get(record.id) ?? null);
      }
      return saved;
    },

    deleteObligationCollectionById: async (
      id: string,
      deletedBy: string = "system",
      reason?: string,
    ) => {
      const res = await collectionCrud.deleteById(id, deletedBy, reason);
      const tenant = getRequestTenant();
      if (tenant && res) await postArchivedCollections(repo, tenant, [id]);
      return res;
    },

    restoreObligationCollectionById: async (id: string, userId?: string): Promise<boolean> => {
      const tenant = getRequestTenant();
      const archived = tenant ? await snapshotArchivedCollections(repo, tenant, [id]) : [];
      const res = await collectionCrud.restoreById(id, userId);
      if (tenant && res) await postRestoredCollections(tenant, archived);
      return res;
    },

    bulkSoftDeleteObligationCollections: async (
      ids: string[],
      deletedBy: string = "system",
      reason?: string,
    ) => {
      const res = await collectionCrud.bulkDeleteByIds(ids, deletedBy, reason);
      const tenant = getRequestTenant();
      if (tenant && res.succeeded > 0) await postArchivedCollections(repo, tenant, ids);
      return res;
    },

    bulkRestoreObligationCollections: async (
      ids: string[],
      userId?: string,
    ): Promise<{ succeeded: number; failed: number }> => {
      const tenant = getRequestTenant();
      const archived = tenant ? await snapshotArchivedCollections(repo, tenant, ids) : [];
      const res = await collectionCrud.bulkRestoreByIds(ids, userId);
      if (tenant && res.succeeded > 0) await postRestoredCollections(tenant, archived);
      return res;
    },

    loadObligationsCommandMetrics: async (): Promise<ObligationsCommandMetricsSnapshot> => {
      const tenant = getRequestTenant();
      if (!tenant) return EMPTY_OBLIGATIONS_METRICS;
      return repo.aggregateObligationsCommandMetrics(tenant);
    },

    loadObligationsReportAggregates: async (
      query: ObligationsReportQuery = {},
    ): Promise<ObligationsReportAggregates> => {
      const tenant = getRequestTenant();
      if (!tenant) {
        return {
          totalCollections: 0,
          totalAmount: 0,
          uniqueReps: 0,
          typeBreakdown: [],
          monthlyTrend: [],
          wakalaSummary: [],
          repSummary: [],
        };
      }
      return repo.aggregateObligationsReport(tenant, query);
    },
  };
}

export const obligationsUseCases = createObligationsUseCases();
