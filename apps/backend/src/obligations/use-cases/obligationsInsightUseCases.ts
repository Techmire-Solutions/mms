/**
 * @file obligationsInsightUseCases.ts
 * @description Command metrics and report aggregates for the Obligations module.
 *
 * Split out of `obligationsUseCases` for the 300-line ceiling. Both are pure tenant-scoped reads
 * that delegate to the repository aggregates; the empty-tenant shapes live here so the main
 * factory does not carry them.
 */
import type {
  ObligationsCommandMetricsSnapshot,
  ObligationsReportAggregates,
  ObligationsReportQuery,
} from "@mms/shared";
import { getRequestTenant } from "../../lib/tenantContext.js";
import type { ObligationsRepository } from "../repository/obligationsRepository.js";

const EMPTY_OBLIGATIONS_METRICS: ObligationsCommandMetricsSnapshot = {
  total: 0,
  totalAmount: 0,
  cash: 0,
  online: 0,
  newThisPeriod: 0,
  obligationTypes: 0,
};

const EMPTY_REPORT_AGGREGATES: ObligationsReportAggregates = {
  totalCollections: 0,
  totalAmount: 0,
  uniqueReps: 0,
  typeBreakdown: [],
  monthlyTrend: [],
  wakalaSummary: [],
  repSummary: [],
};

export function createObligationsInsightUseCases(repo: ObligationsRepository) {
  return {
    loadObligationsCommandMetrics: async (): Promise<ObligationsCommandMetricsSnapshot> => {
      const tenant = getRequestTenant();
      if (!tenant) return EMPTY_OBLIGATIONS_METRICS;
      return repo.aggregateObligationsCommandMetrics(tenant);
    },

    loadObligationsReportAggregates: async (
      query: ObligationsReportQuery = {},
    ): Promise<ObligationsReportAggregates> => {
      const tenant = getRequestTenant();
      if (!tenant) return EMPTY_REPORT_AGGREGATES;
      return repo.aggregateObligationsReport(tenant, query);
    },
  };
}
