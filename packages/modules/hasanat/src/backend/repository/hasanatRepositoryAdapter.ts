import type { HasanatRepository } from "./hasanatRepository.js";
import {
  listDenomsByWorkspace,
  countDenomsByWorkspace,
  findDenomById,
  findDenomsByIds,
  saveDenom,
  bulkSaveDenoms,
  replaceDenomsForWorkspace,
  listBatchesByWorkspace,
  countBatchesByWorkspace,
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
  listRedemptionsPage,
  findRedemptionById,
  findRedemptionsByIds,
  replaceRedemptionsForWorkspace,
} from "./db/hasanatRepository.js";
import {
  lockDistributionForUpdate,
  insertDistribution,
  updateDistributionVersioned,
  setDistributionStatus,
  countIssuedByUserOnDate,
  lockInstructorQuota,
  findDistributionByClientRequestId,
  findBatchRemaining,
} from "./db/hasanatCardOps.js";
import { getHasanatModulePreferences } from "./db/hasanatModulePreferencesRepository.js";
import {
  findFacultyIdForUser,
  findTenantUserRole,
  filterStudentsInFacultyClasses,
  listClassIdsTaughtByFaculty,
} from "./db/hasanatAwardScopeRepository.js";
import {
  appendRedemption,
  findRedemptionByClientRequestId,
  findLiveRedemptionForCard,
  findLedgerRow,
  hasReversal,
  listCardLedger,
} from "./db/hasanatLedgerOps.js";
import {
  listDistributionsPage,
  aggregateHasanatCommandMetrics,
} from "./db/hasanatRepositoryList.js";
import { loadHasanatReportAggregatesSql } from "./db/hasanatRepositoryReport.js";
import { aggregateHasanatWidgetQueries } from "./db/hasanatRepositoryWidgets.js";

export { findSessionIdForClass, findSessionStatuses } from "./db/hasanatCardOps.js";
export {
  findDistributionsByClientRequestIds,
  insertBatchDistributions,
  listBatchRecipients,
  findStudentsByNames,
  type NewBatchCard,
} from "./db/hasanatBatchRepository.js";
export { getHasanatModulePreferences } from "./db/hasanatModulePreferencesRepository.js";
export { loadHasanatStudentReport } from "./db/hasanatReportRepository.js";
export {
  findStudentsForCards,
  getStudentPoints,
  insertStudentAwards,
  listLiveStudentAwards,
  listStudentAwards,
  listTenantTierState,
  revokeStudentAwards,
  type NewAward,
} from "./db/hasanatTierRepository.js";
export { listBatchesByWorkspace, listDenomsByWorkspace } from "./db/hasanatRepository.js";

/**
 * Drizzle-backed adapter for {@link HasanatRepository}. Delegates to the
 * existing concrete repository functions (no SQL rewrite in this pass).
 */
export const hasanatRepository: HasanatRepository = {
  findFacultyIdForUser,
  listClassIdsTaughtByFaculty,
  filterStudentsInFacultyClasses,
  findTenantUserRole,
  listDenomsByWorkspace,
  countDenomsByWorkspace,
  findDenomById,
  findDenomsByIds,
  saveDenom,
  bulkSaveDenoms,
  replaceDenomsForWorkspace,
  listBatchesByWorkspace,
  countBatchesByWorkspace,
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
  listRedemptionsPage,
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
