import type {
  ObligationType,
  Mujtahid,
  MujtahidRep,
  WakalaType,
  ObligationDistribution,
  ObligationCollection,
  ObligationsCommandMetricsSnapshot,
  ObligationsReportAggregates,
  ObligationsReportQuery,
} from "@mms/shared";

/**
 * Sole storage gateway for the obligations module (types, mujtahids, reps,
 * wakala types, distributions, collections).
 *
 * Mirrors the `contacts`/`sessions`/`enrollments`/`finance`/`attendance`/`hasanat`/
 * `questionBank`/`examinations` reference pattern: routes and use-cases depend on
 * this interface (never on Drizzle directly), and the Drizzle-backed adapter is
 * the only implementation. Tests can inject a fake repository at the seam.
 */
export interface ObligationsRepository {
  // Types
  listObligationTypesByWorkspace(tenant: string): Promise<ObligationType[]>;
  findObligationTypeById(tenant: string, id: string): Promise<ObligationType | null>;
  findObligationTypesByIds(tenant: string, ids: string[]): Promise<ObligationType[]>;
  saveObligationType(tenant: string, record: ObligationType): Promise<void>;
  bulkSaveObligationTypes(tenant: string, records: ObligationType[]): Promise<void>;
  replaceObligationTypesForWorkspace(tenant: string, records: ObligationType[]): Promise<void>;

  // Mujtahids
  listMujtahidsByWorkspace(tenant: string): Promise<Mujtahid[]>;
  findMujtahidById(tenant: string, id: string): Promise<Mujtahid | null>;
  findMujtahidsByIds(tenant: string, ids: string[]): Promise<Mujtahid[]>;
  saveMujtahid(tenant: string, record: Mujtahid): Promise<void>;
  bulkSaveMujtahids(tenant: string, records: Mujtahid[]): Promise<void>;
  replaceMujtahidsForWorkspace(tenant: string, records: Mujtahid[]): Promise<void>;

  // Mujtahid reps
  listMujtahidRepsByWorkspace(tenant: string): Promise<MujtahidRep[]>;
  findMujtahidRepById(tenant: string, id: string): Promise<MujtahidRep | null>;
  findMujtahidRepsByIds(tenant: string, ids: string[]): Promise<MujtahidRep[]>;
  saveMujtahidRep(tenant: string, record: MujtahidRep): Promise<void>;
  bulkSaveMujtahidReps(tenant: string, records: MujtahidRep[]): Promise<void>;
  replaceMujtahidRepsForWorkspace(tenant: string, records: MujtahidRep[]): Promise<void>;

  // Wakala types
  listWakalaTypesByWorkspace(tenant: string): Promise<WakalaType[]>;
  findWakalaTypeById(tenant: string, id: string): Promise<WakalaType | null>;
  findWakalaTypesByIds(tenant: string, ids: string[]): Promise<WakalaType[]>;
  saveWakalaType(tenant: string, record: WakalaType): Promise<void>;
  bulkSaveWakalaTypes(tenant: string, records: WakalaType[]): Promise<void>;
  replaceWakalaTypesForWorkspace(tenant: string, records: WakalaType[]): Promise<void>;

  // Distributions
  listObligationDistributionsByWorkspace(tenant: string): Promise<ObligationDistribution[]>;
  findObligationDistributionById(
    tenant: string,
    id: string,
  ): Promise<ObligationDistribution | null>;
  findObligationDistributionsByIds(
    tenant: string,
    ids: string[],
  ): Promise<ObligationDistribution[]>;
  saveObligationDistribution(tenant: string, record: ObligationDistribution): Promise<void>;
  bulkSaveObligationDistributions(tenant: string, records: ObligationDistribution[]): Promise<void>;
  replaceObligationDistributionsForWorkspace(
    tenant: string,
    records: ObligationDistribution[],
  ): Promise<void>;

  // Collections
  listObligationCollectionsByWorkspace(
    tenant: string,
    options?: {
      limit?: number;
      offset?: number;
      deleted?: "active" | "deleted" | "all";
      includeDeleted?: boolean;
    },
  ): Promise<ObligationCollection[]>;
  findObligationCollectionById(tenant: string, id: string): Promise<ObligationCollection | null>;
  findObligationCollectionsByIds(
    tenant: string,
    ids: string[],
    options?: { deleted?: "active" | "deleted" | "all"; includeDeleted?: boolean },
  ): Promise<ObligationCollection[]>;
  saveObligationCollection(tenant: string, record: ObligationCollection): Promise<void>;
  bulkSaveObligationCollections(tenant: string, records: ObligationCollection[]): Promise<void>;
  replaceObligationCollectionsForWorkspace(
    tenant: string,
    records: ObligationCollection[],
  ): Promise<void>;
  bulkSoftDeleteObligationCollections?(
    tenant: string,
    ids: string[],
    deletedBy?: string,
    deletionReason?: string,
  ): Promise<{ succeeded: number; failed: number }>;
  bulkRestoreObligationCollections?(
    tenant: string,
    ids: string[],
    userId?: string,
  ): Promise<{ succeeded: number; failed: number }>;

  // Aggregates
  aggregateObligationsCommandMetrics(
    tenant: string,
    periodDays?: number,
  ): Promise<ObligationsCommandMetricsSnapshot>;
  aggregateObligationsReport(
    tenant: string,
    query?: ObligationsReportQuery,
  ): Promise<ObligationsReportAggregates>;

  // Preferences
  getPreferences?(tenant: string): Promise<Record<string, unknown> | null>;
  setPreferences?(tenant: string, preferences: Record<string, unknown>): Promise<void>;
}
