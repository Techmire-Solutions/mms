import { obligationsUseCases } from "../obligations/use-cases/obligationsUseCases.js";

/**
 * Thin re-export of the obligations use-cases facade.
 *
 * Kept for backward compatibility with existing importers (report routes,
 * tests). New code should depend on
 * `obligations/use-cases/obligationsUseCases.js` directly.
 */
export const loadObligationTypes = obligationsUseCases.loadObligationTypes;
export const loadObligationTypeById = obligationsUseCases.loadObligationTypeById;
export const loadObligationTypesByIds = obligationsUseCases.loadObligationTypesByIds;
export const saveObligationType = obligationsUseCases.saveObligationType;
export const replaceObligationTypes = obligationsUseCases.replaceObligationTypes;
export const loadMujtahids = obligationsUseCases.loadMujtahids;
export const loadMujtahidById = obligationsUseCases.loadMujtahidById;
export const loadMujtahidsByIds = obligationsUseCases.loadMujtahidsByIds;
export const saveMujtahid = obligationsUseCases.saveMujtahid;
export const replaceMujtahids = obligationsUseCases.replaceMujtahids;
export const loadMujtahidReps = obligationsUseCases.loadMujtahidReps;
export const loadMujtahidRepById = obligationsUseCases.loadMujtahidRepById;
export const loadMujtahidRepsByIds = obligationsUseCases.loadMujtahidRepsByIds;
export const saveMujtahidRep = obligationsUseCases.saveMujtahidRep;
export const replaceMujtahidReps = obligationsUseCases.replaceMujtahidReps;
export const loadWakalaTypes = obligationsUseCases.loadWakalaTypes;
export const loadWakalaTypeById = obligationsUseCases.loadWakalaTypeById;
export const loadWakalaTypesByIds = obligationsUseCases.loadWakalaTypesByIds;
export const saveWakalaType = obligationsUseCases.saveWakalaType;
export const replaceWakalaTypes = obligationsUseCases.replaceWakalaTypes;
export const loadObligationDistributions = obligationsUseCases.loadObligationDistributions;
export const loadObligationDistributionById = obligationsUseCases.loadObligationDistributionById;
export const loadObligationDistributionsByIds =
  obligationsUseCases.loadObligationDistributionsByIds;
export const saveObligationDistribution = obligationsUseCases.saveObligationDistribution;
export const replaceObligationDistributions = obligationsUseCases.replaceObligationDistributions;
export const replaceObligationCollections = obligationsUseCases.replaceObligationCollections;
export const loadObligationCollections = obligationsUseCases.loadObligationCollections;
export const loadObligationCollectionById = obligationsUseCases.loadObligationCollectionById;
export const loadObligationCollectionsByIds = obligationsUseCases.loadObligationCollectionsByIds;
export const saveObligationCollection = obligationsUseCases.saveObligationCollection;
export const createObligationCollection = obligationsUseCases.createObligationCollection;
export const updateObligationCollectionById = obligationsUseCases.updateObligationCollectionById;
export const upsertObligationTypes = obligationsUseCases.upsertObligationTypes;
export const upsertMujtahids = obligationsUseCases.upsertMujtahids;
export const upsertMujtahidReps = obligationsUseCases.upsertMujtahidReps;
export const upsertWakalaTypes = obligationsUseCases.upsertWakalaTypes;
export const upsertObligationDistributions = obligationsUseCases.upsertObligationDistributions;
export const upsertObligationCollections = obligationsUseCases.upsertObligationCollections;
export const deleteObligationCollectionById = obligationsUseCases.deleteObligationCollectionById;
export const restoreObligationCollectionById = obligationsUseCases.restoreObligationCollectionById;
export const bulkSoftDeleteObligationCollections =
  obligationsUseCases.bulkSoftDeleteObligationCollections;
export const bulkRestoreObligationCollections =
  obligationsUseCases.bulkRestoreObligationCollections;
export const loadObligationsCommandMetrics = obligationsUseCases.loadObligationsCommandMetrics;
export const loadObligationsReportAggregates = obligationsUseCases.loadObligationsReportAggregates;
