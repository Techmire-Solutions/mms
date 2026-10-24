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
  saveRedemption,
  bulkSaveRedemptions,
  replaceRedemptionsForWorkspace,
} from "../../db/repositories/hasanatRepository.js";
import {
  listDistributionsPage,
  aggregateHasanatCommandMetrics,
} from "../../db/repositories/hasanatRepositoryList.js";
import { loadHasanatReportAggregatesSql } from "../../db/repositories/hasanatRepositoryReport.js";
import { aggregateHasanatWidgetQueries } from "../../db/repositories/hasanatRepositoryWidgets.js";

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
  saveRedemption,
  bulkSaveRedemptions,
  replaceRedemptionsForWorkspace,
  aggregateHasanatCommandMetrics,
  aggregateHasanatWidgetQueries,
  loadHasanatReportAggregates: loadHasanatReportAggregatesSql,
};
