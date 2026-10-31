import type { ObligationsRepository } from "./obligationsRepository.js";
import { listAccountsByWorkspace } from "../../db/repositories/accountingAccountsRepository.js";
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
} from "../../db/repositories/obligationRepository.js";
import { aggregateObligationsCommandMetrics } from "../../db/repositories/obligationRepositoryMetrics.js";
import { aggregateObligationsReport } from "../../db/repositories/obligationRepositoryReport.js";
import {
  getObligationModulePreferences,
  setObligationModulePreferences,
} from "../../db/repositories/obligationModulePreferencesRepository.js";

/** Active ledger account ids, used to validate wakala distribution mappings. */
async function listLedgerAccountIds(tenant: string): Promise<string[]> {
  const accounts = await listAccountsByWorkspace(tenant);
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
  aggregateObligationsCommandMetrics,
  aggregateObligationsReport,
  getPreferences: getObligationModulePreferences,
  setPreferences: setObligationModulePreferences,
};
