import type { ObligationsRepository } from "./obligationsRepository.js";
import { obligationsListAccountsByWorkspace } from "../ports.js";
import {
  listObligationTypesByWorkspace,
  findObligationTypeById,
  findObligationTypesByIds,
  saveObligationType,
  bulkSaveObligationTypes,
  replaceObligationTypesForWorkspace,
  listMujtahidsByWorkspace,
  findMujtahidById,
  findMujtahidsByIds,
  saveMujtahid,
  bulkSaveMujtahids,
  replaceMujtahidsForWorkspace,
  listMujtahidRepsByWorkspace,
  findMujtahidRepById,
  findMujtahidRepsByIds,
  saveMujtahidRep,
  bulkSaveMujtahidReps,
  replaceMujtahidRepsForWorkspace,
  listWakalaTypesByWorkspace,
  findWakalaTypeById,
  findWakalaTypesByIds,
  saveWakalaType,
  bulkSaveWakalaTypes,
  replaceWakalaTypesForWorkspace,
  replaceWakalaAggregateForWorkspace,
  listObligationDistributionsByWorkspace,
  findObligationDistributionById,
  findObligationDistributionsByIds,
  saveObligationDistribution,
  bulkSaveObligationDistributions,
  replaceObligationDistributionsForWorkspace,
  listObligationCollectionsByWorkspace,
  findObligationCollectionById,
  findObligationCollectionsByIds,
  saveObligationCollection,
  bulkSaveObligationCollections,
  replaceObligationCollectionsForWorkspace,
  bulkSoftDeleteObligationCollections,
  bulkRestoreObligationCollections,
} from "../repository/obligationRepository.js";
import { allocateObligationReceiptNumbers } from "../repository/obligationReceiptNumbering.js";
import { countCatalogueDependents } from "../repository/obligationCatalogueDependentsRepository.js";
import { aggregateObligationsCommandMetrics } from "../repository/obligationRepositoryMetrics.js";
import { aggregateObligationsReport } from "../repository/obligationRepositoryReport.js";
import {
  getObligationModulePreferences,
  setObligationModulePreferences,
} from "../repository/obligationModulePreferencesRepository.js";

/** Active ledger account ids, used to validate wakala distribution mappings. */
async function listLedgerAccountIds(tenant: string): Promise<string[]> {
  const accounts = await obligationsListAccountsByWorkspace(tenant);
  return accounts.map((account) => account.id);
}

/**
 * Drizzle-backed adapter for {@link ObligationsRepository}. Delegates to the
 * existing concrete repository functions (no SQL rewrite in this pass).
 */
export const obligationsRepository: ObligationsRepository = {
  listObligationTypesByWorkspace,
  findObligationTypeById,
  findObligationTypesByIds,
  saveObligationType,
  bulkSaveObligationTypes,
  replaceObligationTypesForWorkspace,
  listMujtahidsByWorkspace,
  findMujtahidById,
  findMujtahidsByIds,
  saveMujtahid,
  bulkSaveMujtahids,
  replaceMujtahidsForWorkspace,
  listMujtahidRepsByWorkspace,
  findMujtahidRepById,
  findMujtahidRepsByIds,
  saveMujtahidRep,
  bulkSaveMujtahidReps,
  replaceMujtahidRepsForWorkspace,
  listWakalaTypesByWorkspace,
  findWakalaTypeById,
  findWakalaTypesByIds,
  saveWakalaType,
  bulkSaveWakalaTypes,
  replaceWakalaTypesForWorkspace,
  replaceWakalaAggregateForWorkspace,
  countCatalogueDependents,
  listLedgerAccountIds,
  listObligationDistributionsByWorkspace,
  findObligationDistributionById,
  findObligationDistributionsByIds,
  saveObligationDistribution,
  bulkSaveObligationDistributions,
  replaceObligationDistributionsForWorkspace,
  listObligationCollectionsByWorkspace,
  findObligationCollectionById,
  findObligationCollectionsByIds,
  saveObligationCollection,
  bulkSaveObligationCollections,
  replaceObligationCollectionsForWorkspace,
  bulkSoftDeleteObligationCollections,
  bulkRestoreObligationCollections,
  allocateReceiptNumbers: allocateObligationReceiptNumbers,
  aggregateObligationsCommandMetrics,
  aggregateObligationsReport,
  getPreferences: getObligationModulePreferences,
  setPreferences: setObligationModulePreferences,
};
