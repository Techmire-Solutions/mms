import { hasanatUseCases } from "../hasanat/use-cases/hasanatUseCases.js";

/**
 * Thin re-export of the hasanat use-cases facade.
 *
 * Kept for backward compatibility with existing importers (report routes,
 * dashboard summary, tests). New code should depend on
 * `hasanat/use-cases/hasanatUseCases.js` directly.
 */
export const loadDenoms = hasanatUseCases.loadDenoms;
export const loadDenomById = hasanatUseCases.loadDenomById;
export const loadDenomsByIds = hasanatUseCases.loadDenomsByIds;
export const saveDenom = hasanatUseCases.saveDenom;
export const replaceDenoms = hasanatUseCases.replaceDenoms;

export const loadBatches = hasanatUseCases.loadBatches;
export const loadBatchById = hasanatUseCases.loadBatchById;
export const loadBatchesByIds = hasanatUseCases.loadBatchesByIds;
export const saveBatch = hasanatUseCases.saveBatch;
export const replaceBatches = hasanatUseCases.replaceBatches;

export const loadDistributions = hasanatUseCases.loadDistributions;
export const loadDistributionById = hasanatUseCases.loadDistributionById;
export const loadDistributionsByIds = hasanatUseCases.loadDistributionsByIds;
export const replaceDistributions = hasanatUseCases.replaceDistributions;
export const loadDistributionsPage = hasanatUseCases.loadDistributionsPage;

export const loadRedemptions = hasanatUseCases.loadRedemptions;
export const loadRedemptionById = hasanatUseCases.loadRedemptionById;
export const loadRedemptionsByIds = hasanatUseCases.loadRedemptionsByIds;
export const saveRedemption = hasanatUseCases.saveRedemption;
export const replaceRedemptions = hasanatUseCases.replaceRedemptions;

export const upsertDenoms = hasanatUseCases.upsertDenoms;
export const upsertBatches = hasanatUseCases.upsertBatches;
export const upsertDistributions = hasanatUseCases.upsertDistributions;
export const upsertRedemptions = hasanatUseCases.upsertRedemptions;
export const deleteDistributionById = hasanatUseCases.deleteDistributionById;
export const createDistribution = hasanatUseCases.createDistribution;
export const updateDistributionById = hasanatUseCases.updateDistributionById;
export const restoreDistributionById = hasanatUseCases.restoreDistributionById;
export const bulkSoftDeleteDistributions = hasanatUseCases.bulkSoftDeleteDistributions;
export const bulkRestoreDistributions = hasanatUseCases.bulkRestoreDistributions;
export const loadHasanatReportAggregates = hasanatUseCases.loadHasanatReportAggregates;
export const loadHasanatCommandMetrics = hasanatUseCases.loadHasanatCommandMetrics;
export const loadHasanatWidgetAggregates = hasanatUseCases.loadHasanatWidgetAggregates;
