import type { HasanatRepository } from "./hasanatRepository.js";
import {
  listDenomsByWorkspace,
  findDenomById,
  findDenomsByIds,
  saveDenom,
  bulkSaveDenoms,
  replaceDenomsForWorkspace,
  listBatchesByWorkspace,
  findBatchById,
  findBatchesByIds,
  saveBatch,
  bulkSaveBatches,
  replaceBatchesForWorkspace,
  listDistributionsByWorkspace,
  findDistributionById,
  findDistributionsByIds,
  saveDistribution,
  bulkSaveDistributions,
  replaceDistributionsForWorkspace,
  bulkSoftDeleteDistributions,
  bulkRestoreDistributions,
  listRedemptionsByWorkspace,
  findRedemptionById,
  findRedemptionsByIds,
  replaceRedemptionsForWorkspace,
} from "../../db/repositories/hasanatRepository.js";
import {
  lockDistributionForUpdate,
  insertDistribution,
  updateDistributionVersioned,
  setDistributionStatus,
  countIssuedByUserOnDate,
  lockInstructorQuota,
  findDistributionByClientRequestId,
  findBatchRemaining,
} from "../../db/repositories/hasanatCardOps.js";
import { getHasanatModulePreferences } from "../../db/repositories/hasanatModulePreferencesRepository.js";
import {
  appendRedemption,
  findRedemptionByClientRequestId,
  findLiveRedemptionForCard,
  findLedgerRow,
  hasReversal,
  listCardLedger,
} from "../../db/repositories/hasanatLedgerOps.js";
import {
  listDistributionsPage,
  aggregateHasanatCommandMetrics,
} from "../../db/repositories/hasanatRepositoryList.js";
import { loadHasanatReportAggregatesSql } from "../../db/repositories/hasanatRepositoryReport.js";
import { aggregateHasanatWidgetQueries } from "../../db/repositories/hasanatRepositoryWidgets.js";

export {
  findSessionIdForClass,
  findSessionStatuses,
} from "../../db/repositories/hasanatCardOps.js";
export {
  findDistributionsByClientRequestIds,
  insertBatchDistributions,
  listBatchRecipients,
  findStudentsByNames,
  type NewBatchCard,
} from "../../db/repositories/hasanatBatchRepository.js";
export { getHasanatModulePreferences } from "../../db/repositories/hasanatModulePreferencesRepository.js";
export { loadHasanatStudentReport } from "../../db/repositories/hasanatReportRepository.js";
export {
  findStudentsForCards,
  getStudentPoints,
  insertStudentAwards,
  listLiveStudentAwards,
  listStudentAwards,
  listTenantTierState,
  revokeStudentAwards,
  type NewAward,
} from "../../db/repositories/hasanatTierRepository.js";
export {
  listBatchesByWorkspace,
  listDenomsByWorkspace,
} from "../../db/repositories/hasanatRepository.js";

/**
 * Drizzle-backed adapter for {@link HasanatRepository}. Delegates to the
 * existing concrete repository functions (no SQL rewrite in this pass).
 */
export const hasanatRepository: HasanatRepository = {
  listDenomsByWorkspace,
  findDenomById,
  findDenomsByIds,
  saveDenom,
  bulkSaveDenoms,
  replaceDenomsForWorkspace,
  listBatchesByWorkspace,
  findBatchById,
  findBatchesByIds,
  saveBatch,
  bulkSaveBatches,
  replaceBatchesForWorkspace,
  listDistributionsByWorkspace,
  findDistributionById,
  findDistributionsByIds,
  saveDistribution,
  bulkSaveDistributions,
  replaceDistributionsForWorkspace,
  bulkSoftDeleteDistributions,
  bulkRestoreDistributions,
  listDistributionsPage,
  listRedemptionsByWorkspace,
  findRedemptionById,
  findRedemptionsByIds,
  replaceRedemptionsForWorkspace,
  lockDistributionForUpdate,
  insertDistribution,
  updateDistributionVersioned,
  setDistributionStatus,
  countIssuedByUserOnDate,
  lockInstructorQuota,
  findDistributionByClientRequestId,
  findBatchRemaining,
  appendRedemption,
  findRedemptionByClientRequestId,
  findLiveRedemptionForCard,
  findLedgerRow,
  hasReversal,
  listCardLedger,
  aggregateHasanatCommandMetrics,
  aggregateHasanatWidgetQueries,
  loadHasanatReportAggregates: loadHasanatReportAggregatesSql,
  getModulePreferences: getHasanatModulePreferences,
};
