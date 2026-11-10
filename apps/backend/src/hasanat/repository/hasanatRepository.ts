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
import type { CardPatch, NewCardFields } from "../../db/repositories/hasanatCardOps.js";
import type { NewRedemptionFields } from "../../db/repositories/hasanatLedgerOps.js";

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
  listDenomsByWorkspace(
    tenant: string,
    options?: { limit?: number; offset?: number },
  ): Promise<Denomination[]>;
  countDenomsByWorkspace(tenant: string): Promise<number>;
  findDenomById(tenant: string, id: string): Promise<Denomination | null>;
  findDenomsByIds(tenant: string, ids: string[]): Promise<Denomination[]>;
  saveDenom(tenant: string, record: Denomination): Promise<void>;
  bulkSaveDenoms(tenant: string, records: Denomination[]): Promise<void>;
  replaceDenomsForWorkspace(tenant: string, records: Denomination[]): Promise<void>;

  // Batches
  listBatchesByWorkspace(
    tenant: string,
    options?: { limit?: number; offset?: number },
  ): Promise<StockBatch[]>;
  countBatchesByWorkspace(tenant: string): Promise<number>;
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

  // Card write primitives (rules live in `hasanat/use-cases/*`)
  lockDistributionForUpdate(tenant: string, id: string): Promise<Distribution | null>;
  /** Plain insert of an already-validated card; `pointsSnapshot` is stamped by the use case. */
  insertDistribution(tenant: string, fields: NewCardFields): Promise<Distribution>;
  /** Compare-and-set on `version`; `null` means the caller's copy was stale. */
  updateDistributionVersioned(
    tenant: string,
    id: string,
    patch: CardPatch,
    expectedVersion: number,
  ): Promise<Distribution | null>;
  setDistributionStatus(
    tenant: string,
    id: string,
    status: Distribution["status"],
  ): Promise<Distribution | null>;
  /** Cards issued by one instructor on one calendar day (the quota input). */
  countIssuedByUserOnDate(tenant: string, userId: string, issuedDate: string): Promise<number>;
  /** Transaction-scoped advisory lock for the quota check-then-insert. */
  lockInstructorQuota(tenant: string, userId: string, issuedDate: string): Promise<void>;
  findDistributionByClientRequestId(
    tenant: string,
    clientRequestId: string,
  ): Promise<Distribution | null>;
  findBatchRemaining(tenant: string, batchId: string): Promise<number | null>;

  // Redemptions (append-only; corrections are reversal rows)
  listRedemptionsByWorkspace(tenant: string): Promise<Redemption[]>;
  listRedemptionsPage(
    tenant: string,
    query: {
      page?: number;
      limit?: number;
      from?: string;
      to?: string;
      kind?: "redeem" | "reversal";
      studentId?: string;
      distributionId?: string;
    },
  ): Promise<{
    redemptions: Redemption[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }>;
  findRedemptionById(tenant: string, id: string): Promise<Redemption | null>;
  findRedemptionsByIds(tenant: string, ids: string[]): Promise<Redemption[]>;
  appendRedemption(tenant: string, fields: NewRedemptionFields): Promise<Redemption>;
  findRedemptionByClientRequestId(
    tenant: string,
    clientRequestId: string,
  ): Promise<Redemption | null>;
  findLiveRedemptionForCard(tenant: string, distributionId: string): Promise<Redemption | null>;
  findLedgerRow(tenant: string, id: string): Promise<Redemption | null>;
  hasReversal(tenant: string, redemptionId: string): Promise<boolean>;
  listCardLedger(tenant: string, distributionId: string): Promise<Redemption[]>;
  replaceRedemptionsForWorkspace(tenant: string, records: Redemption[]): Promise<void>;

  // Preferences
  getModulePreferences?(tenant: string): Promise<Record<string, unknown> | null>;

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
