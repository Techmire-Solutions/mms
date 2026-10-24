import { type FastifyInstance, type FastifyPluginOptions } from "fastify";
import { authenticateTenant } from "../../middleware/authenticate.js";
import { registerModuleAccess } from "../../middleware/requireTenantModule.js";
import {
  OBLIGATIONS_MODULE_MANIFEST,
  obligationTypeListSchema,
  mujtahidListSchema,
  mujtahidRepListSchema,
  wakalaTypeListSchema,
  obligationDistributionListSchema,
  obligationCollectionListSchema,
} from "@mms/shared";
import {
  registerBulkRoutes,
  registerMetricsRoute,
  registerSoftDeletableBulkRoutes,
} from "../../lib/crudRouter.js";

import { obligationContractRouter } from "./obligations/obligationContractRouter.js";
import { obligationReportRoutes } from "./obligations/obligationReportRoutes.js";
import { obligationsExportRoutes } from "./obligations/obligationsExportRoutes.js";
import { obligationsUseCases } from "../../obligations/use-cases/obligationsUseCases.js";

const OBLIGATIONS_COLLECTION = OBLIGATIONS_MODULE_MANIFEST.collectionKey;

/**
 * Obligations module routes — bulk upsert lookups + soft-delete collections.
 */
export default async function obligationsRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.addHook("preHandler", authenticateTenant);
  registerModuleAccess(fastify, "obligations");

  await fastify.register(
    async (sub) => {
      registerBulkRoutes(sub, {
        path: "/types",
        collection: OBLIGATIONS_COLLECTION,
        schema: obligationTypeListSchema,
        saveFn: obligationsUseCases.replaceObligationTypes,
        responseKey: "types",
        errorMessagePrefix: "obligation types",
        customGetRoute: true,
      });

      registerBulkRoutes(sub, {
        path: "/mujtahids",
        collection: OBLIGATIONS_COLLECTION,
        schema: mujtahidListSchema,
        saveFn: obligationsUseCases.replaceMujtahids,
        responseKey: "mujtahids",
        errorMessagePrefix: "mujtahids",
        customGetRoute: true,
      });

      registerBulkRoutes(sub, {
        path: "/reps",
        collection: OBLIGATIONS_COLLECTION,
        schema: mujtahidRepListSchema,
        loadFn: obligationsUseCases.loadMujtahidReps,
        saveFn: obligationsUseCases.replaceMujtahidReps,
        responseKey: "reps",
        errorMessagePrefix: "mujtahid reps",
      });

      registerBulkRoutes(sub, {
        path: "/wakala",
        collection: OBLIGATIONS_COLLECTION,
        schema: wakalaTypeListSchema,
        loadFn: obligationsUseCases.loadWakalaTypes,
        saveFn: obligationsUseCases.replaceWakalaTypes,
        responseKey: "wakalaTypes",
        errorMessagePrefix: "wakala types",
      });

      registerBulkRoutes(sub, {
        path: "/distributions",
        collection: OBLIGATIONS_COLLECTION,
        schema: obligationDistributionListSchema,
        saveFn: obligationsUseCases.replaceObligationDistributions,
        responseKey: "distributions",
        errorMessagePrefix: "obligation distributions",
        customGetRoute: true,
      });

      registerSoftDeletableBulkRoutes(sub, {
        path: "/collections",
        collection: OBLIGATIONS_COLLECTION,
        schema: obligationCollectionListSchema,
        loadFn: obligationsUseCases.loadObligationCollections,
        saveFn: obligationsUseCases.upsertObligationCollections,
        deleteFn: obligationsUseCases.deleteObligationCollectionById,
        restoreFn: obligationsUseCases.restoreObligationCollectionById,
        bulkDeleteFn: obligationsUseCases.bulkSoftDeleteObligationCollections,
        bulkRestoreFn: (ids, userId) =>
          obligationsUseCases.bulkRestoreObligationCollections(ids, userId),
        responseKey: "collections",
        errorMessagePrefix: "obligation collections",
        nameSingular: "Obligation collection",
        customGetRoute: true,
      });

      registerMetricsRoute(sub, {
        collection: OBLIGATIONS_COLLECTION,
        loadMetricsFn: obligationsUseCases.loadObligationsCommandMetrics,
        errorMessagePrefix: "obligation",
      });

      await sub.register(obligationsExportRoutes);
      await sub.register(obligationReportRoutes);
    },
    { prefix: "/api/obligations" },
  );

  await fastify.register(obligationContractRouter);
}
