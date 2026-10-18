import type {
  Denomination,
  StockBatch,
  Distribution,
  Redemption,
  HasanatListQuery,
  HasanatDistributionsListPageResult,
  HasanatCommandMetricsSnapshot,
  HasanatReportAggregates,
  HasanatReportComparisonQuery,
  WidgetQuery,
  WidgetAggregateResult,
} from "@mms/shared";

/**
 * Sole storage gateway for the hasanat module (denoms, batches, distributions,
 * redemptions).
 *
 * Mirrors the `contacts`/`sessions`/`enrollments`/`finance`/`attendance`
 * reference pattern: routes and use-cases depend on this interface (never on
 * Drizzle directly), and the Drizzle-backed adapter is the only implementation.
 * Tests can inject a fake repository at the seam.
 */
export interface HasanatRepository {
  // Denoms
  listDenomsByWorkspace(tenant: string): Promise<Denomination[]>;
  findDenomById(tenant: string, id: string): Promise<Denomination | null>;
  findDenomsByIds(tenant: string, ids: string[]): Promise<Denomination[]>;
  saveDenom(tenant: string, record: Denomination): Promise<void>;
  bulkSaveDenoms(tenant: string, records: Denomination[]): Promise<void>;
  replaceDenomsForWorkspace(tenant: string, records: Denomination[]): Promise<void>;

  // Batches
  listBatchesByWorkspace(tenant: string): Promise<StockBatch[]>;
  findBatchById(tenant: string, id: string): Promise<StockBatch | null>;
  findBatchesByIds(tenant: string, ids: string[]): Promise<StockBatch[]>;
  saveBatch(tenant: string, record: StockBatch): Promise<void>;
  bulkSaveBatches(tenant: string, records: StockBatch[]): Promise<void>;
  replaceBatchesForWorkspace(tenant: string, records: StockBatch[]): Promise<void>;

  // Distributions
  listDistributionsByWorkspace(
    tenant: string,
    options?: {
      limit?: number;
      offset?: number;
      deleted?: "active" | "deleted" | "all";
      includeDeleted?: boolean;
    },
  ): Promise<Distribution[]>;
  findDistributionById(tenant: string, id: string): Promise<Distribution | null>;
  findDistributionsByIds(
    tenant: string,
    ids: string[],
    options?: { deleted?: "active" | "deleted" | "all"; includeDeleted?: boolean },
  ): Promise<Distribution[]>;
  saveDistribution(tenant: string, record: Distribution): Promise<void>;
  bulkSaveDistributions(tenant: string, records: Distribution[]): Promise<void>;
  replaceDistributionsForWorkspace(tenant: string, records: Distribution[]): Promise<void>;
  bulkSoftDeleteDistributions?(
    tenant: string,
    ids: string[],
    deletedBy?: string,
    deletionReason?: string,
  ): Promise<{ succeeded: number; failed: number }>;
  bulkRestoreDistributions?(
    tenant: string,
    ids: string[],
    userId?: string,
  ): Promise<{ succeeded: number; failed: number }>;
  listDistributionsPage(
    tenant: string,
    query: HasanatListQuery,
  ): Promise<HasanatDistributionsListPageResult>;

  // Redemptions
  listRedemptionsByWorkspace(tenant: string): Promise<Redemption[]>;
  findRedemptionById(tenant: string, id: string): Promise<Redemption | null>;
  findRedemptionsByIds(tenant: string, ids: string[]): Promise<Redemption[]>;
  saveRedemption(tenant: string, record: Redemption): Promise<void>;
  bulkSaveRedemptions(tenant: string, records: Redemption[]): Promise<void>;
  replaceRedemptionsForWorkspace(tenant: string, records: Redemption[]): Promise<void>;

  // Aggregates
  aggregateHasanatCommandMetrics(tenant: string): Promise<HasanatCommandMetricsSnapshot>;
  aggregateHasanatWidgetQueries(
    tenant: string,
    queries: WidgetQuery[],
  ): Promise<Record<string, WidgetAggregateResult>>;
  loadHasanatReportAggregates(
    tenant: string,
    comparisonQuery?: HasanatReportComparisonQuery,
  ): Promise<HasanatReportAggregates>;
}
