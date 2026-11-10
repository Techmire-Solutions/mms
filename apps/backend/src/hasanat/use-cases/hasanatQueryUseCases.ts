/**
 * Hasanat read use cases — tenant resolution plus repository delegation.
 *
 * Reads carry no business rules; keeping them here lets the write facade stay small enough to
 * hold the composition of the issuance/redemption/lifecycle use cases.
 */

import {
  dedupeTrimmedIds,
  normalizeHasanatReportComparisonQuery,
  type Denomination,
  type Distribution,
  type HasanatCommandMetricsSnapshot,
  type HasanatDistributionsListPageResult,
  type HasanatListQuery,
  type HasanatReportAggregates,
  type HasanatReportComparisonQuery,
  type Redemption,
  type StockBatch,
  type WidgetAggregateResult,
  type WidgetQuery,
} from "@mms/shared";
import { getRequestTenant } from "../../lib/tenantContext.js";
import type { HasanatRepository } from "../repository/hasanatRepository.js";

const EMPTY_HASANAT_METRICS: HasanatCommandMetricsSnapshot = {
  totalStock: 0,
  available: 0,
  distributed: 0,
  redeemed: 0,
  active: 0,
  returned: 0,
  denominations: 0,
  totalPointsDistributed: 0,
  pointsThisWeek: 0,
  pointsLastWeek: 0,
  //@ts-expect-error fallback
  pointsMonth: 0,
};

export function createHasanatQueryUseCases(repo: HasanatRepository) {
  return {
    loadDenoms: async (): Promise<Denomination[]> => {
      const tenant = getRequestTenant();
      return tenant ? repo.listDenomsByWorkspace(tenant) : [];
    },
    loadDenomById: async (id: string): Promise<Denomination | null> => {
      const tenant = getRequestTenant();
      const cleanId = id?.trim();
      if (!tenant || !cleanId) return null;
      return repo.findDenomById(tenant, cleanId);
    },
    loadDenomsByIds: async (ids: string[]): Promise<Denomination[]> => {
      const tenant = getRequestTenant();
      if (!tenant) return [];
      const cleanIds = dedupeTrimmedIds(ids);
      if (cleanIds.length === 0) return [];
      return repo.findDenomsByIds(tenant, cleanIds);
    },

    loadBatches: async (): Promise<StockBatch[]> => {
      const tenant = getRequestTenant();
      return tenant ? repo.listBatchesByWorkspace(tenant) : [];
    },
    loadBatchById: async (id: string): Promise<StockBatch | null> => {
      const tenant = getRequestTenant();
      const cleanId = id?.trim();
      if (!tenant || !cleanId) return null;
      return repo.findBatchById(tenant, cleanId);
    },
    loadBatchesByIds: async (ids: string[]): Promise<StockBatch[]> => {
      const tenant = getRequestTenant();
      if (!tenant) return [];
      const cleanIds = dedupeTrimmedIds(ids);
      if (cleanIds.length === 0) return [];
      return repo.findBatchesByIds(tenant, cleanIds);
    },

    loadRedemptions: async (): Promise<Redemption[]> => {
      const tenant = getRequestTenant();
      return tenant ? repo.listRedemptionsByWorkspace(tenant) : [];
    },
    loadRedemptionById: async (id: string): Promise<Redemption | null> => {
      const tenant = getRequestTenant();
      const cleanId = id?.trim();
      if (!tenant || !cleanId) return null;
      return repo.findRedemptionById(tenant, cleanId);
    },
    loadRedemptionsByIds: async (ids: string[]): Promise<Redemption[]> => {
      const tenant = getRequestTenant();
      if (!tenant) return [];
      const cleanIds = dedupeTrimmedIds(ids);
      if (cleanIds.length === 0) return [];
      return repo.findRedemptionsByIds(tenant, cleanIds);
    },

    loadDistributions: async (opts?: { includeDeleted?: boolean }): Promise<Distribution[]> => {
      const tenant = getRequestTenant();
      if (!tenant) return [];
      return repo.listDistributionsByWorkspace(tenant, {
        deleted: opts?.includeDeleted ? "deleted" : "active",
      });
    },
    loadDistributionById: async (
      id: string,
      includeDeleted = false,
    ): Promise<Distribution | null> => {
      const tenant = getRequestTenant();
      const cleanId = id?.trim();
      if (!tenant || !cleanId) return null;
      const dist = await repo.findDistributionById(tenant, cleanId);
      if (!dist) return null;
      if (!includeDeleted && dist.deletedAt) return null;
      if (includeDeleted && !dist.deletedAt) return null;
      return dist;
    },
    loadDistributionsByIds: async (
      ids: string[],
      includeDeleted = false,
    ): Promise<Distribution[]> => {
      const tenant = getRequestTenant();
      if (!tenant) return [];
      const cleanIds = dedupeTrimmedIds(ids);
      if (cleanIds.length === 0) return [];
      return repo.findDistributionsByIds(tenant, cleanIds, { includeDeleted });
    },
    loadDistributionsPage: async (
      query: HasanatListQuery & { includeDeleted?: boolean },
    ): Promise<HasanatDistributionsListPageResult> => {
      const tenant = getRequestTenant();
      if (!tenant) {
        return {
          distributions: [],
          total: 0,
          page: query.page ?? 1,
          limit: query.limit ?? 15,
          hasMore: false,
        };
      }
      return repo.listDistributionsPage(tenant, query);
    },

    loadHasanatReportAggregates: async (
      comparisonQuery?: HasanatReportComparisonQuery,
    ): Promise<HasanatReportAggregates> => {
      const tenant = getRequestTenant();
      if (!tenant) {
        return { comparison: { sessions: [], monthly: { a: [], b: [] } } };
      }
      return repo.loadHasanatReportAggregates(
        tenant,
        normalizeHasanatReportComparisonQuery(comparisonQuery),
      );
    },
    loadHasanatCommandMetrics: async (): Promise<HasanatCommandMetricsSnapshot> => {
      const tenant = getRequestTenant();
      if (!tenant) return EMPTY_HASANAT_METRICS;
      return repo.aggregateHasanatCommandMetrics(tenant);
    },
    loadHasanatWidgetAggregates: async (
      queries: WidgetQuery[],
    ): Promise<Record<string, WidgetAggregateResult>> => {
      const tenant = getRequestTenant();
      if (!tenant) return {};
      return repo.aggregateHasanatWidgetQueries(tenant, queries);
    },
  };
}
