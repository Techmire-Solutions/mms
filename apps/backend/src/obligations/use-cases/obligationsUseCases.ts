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
      await repo.saveObligationCollection(tenant, record);
    },

    createObligationCollection: collectionCrud.create,
    updateObligationCollectionById: collectionCrud.updateById,

    upsertObligationCollections: (records: ObligationCollection[]) =>
      upsertWithBroadcast(
        obligationCollectionListSchema,
        records,
        repo.bulkSaveObligationCollections,
        "obligation_collections",
      ),

    deleteObligationCollectionById: collectionCrud.deleteById,
    restoreObligationCollectionById: collectionCrud.restoreById,
    bulkSoftDeleteObligationCollections: collectionCrud.bulkDeleteByIds,
    bulkRestoreObligationCollections: collectionCrud.bulkRestoreByIds,

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
