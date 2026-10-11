import { type FastifyInstance, type FastifyPluginOptions } from "fastify";
import { authenticateTenant } from "../../middleware/authenticate.js";
import { registerModuleAccess } from "../../middleware/requireTenantModule.js";
import {
  HASANAT_MODULE_MANIFEST,
  denomListSchema,
  batchListSchema,
  distributionListSchema,
  redemptionListSchema,
} from "@mms/shared";
import {
  registerBulkRoutes,
  registerMetricsRoute,
  registerSoftDeletableBulkRoutes,
} from "../../lib/crudRouter.js";
import { hasanatUseCases } from "../../hasanat/use-cases/hasanatUseCases.js";
import { hasanatReportRoutes } from "./hasanat/hasanatReportRoutes.js";
import { hasanatSetupConfigRoutes } from "./hasanatSetupConfigRoutes.js";
import { hasanatContractRouter } from "./hasanat/hasanatContractRouter.js";
import { hasanatExportRoutes } from "./hasanat/hasanatExportRoutes.js";

const HASANAT_DISTRIBUTIONS_COLLECTION = HASANAT_MODULE_MANIFEST.collectionKey;
const HASANAT_DENOMS_COLLECTION = HASANAT_MODULE_MANIFEST.denomCollectionKey;
const HASANAT_BATCHES_COLLECTION = HASANAT_MODULE_MANIFEST.batchCollectionKey;
const HASANAT_REDEMPTIONS_COLLECTION = HASANAT_MODULE_MANIFEST.redemptionCollectionKey;

/**
 * Hasanat module routes — bulk upsert + soft-delete distributions.
 */
export default async function hasanatRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.addHook("preHandler", authenticateTenant);
  registerModuleAccess(fastify, "hasanat");

  await fastify.register(
    async (sub) => {
      await sub.register(hasanatReportRoutes);
      await sub.register(hasanatSetupConfigRoutes);
      await sub.register(hasanatExportRoutes);

      registerMetricsRoute(sub, {
        collection: HASANAT_DISTRIBUTIONS_COLLECTION,
        loadMetricsFn: hasanatUseCases.loadHasanatCommandMetrics,
        errorMessagePrefix: "hasanat",
      });

      registerBulkRoutes(sub, {
        path: "/denoms",
        collection: HASANAT_DENOMS_COLLECTION,
        schema: denomListSchema,
        saveFn: hasanatUseCases.upsertDenoms,
        responseKey: "denoms",
        errorMessagePrefix: "denominations",
        customGetRoute: true,
      });

      registerBulkRoutes(sub, {
        path: "/batches",
        collection: HASANAT_BATCHES_COLLECTION,
        schema: batchListSchema,
        saveFn: hasanatUseCases.upsertBatches,
        responseKey: "batches",
        errorMessagePrefix: "batches",
        customGetRoute: true,
      });

      registerSoftDeletableBulkRoutes(sub, {
        path: "/distributions",
        collection: HASANAT_DISTRIBUTIONS_COLLECTION,
        schema: distributionListSchema,
        loadFn: hasanatUseCases.loadDistributions,
        saveFn: hasanatUseCases.upsertDistributions,
        deleteFn: hasanatUseCases.deleteDistributionById,
        restoreFn: hasanatUseCases.restoreDistributionById,
        bulkDeleteFn: hasanatUseCases.bulkSoftDeleteDistributions,
        bulkRestoreFn: (ids, userId) => hasanatUseCases.bulkRestoreDistributions(ids, userId),
        responseKey: "distributions",
        errorMessagePrefix: "distributions",
        nameSingular: "Distribution",

        customGetRoute: true,
        customBulkTrashRoutes: true,
      });

      registerBulkRoutes(sub, {
        path: "/redemptions",
        collection: HASANAT_REDEMPTIONS_COLLECTION,
        schema: redemptionListSchema,
        saveFn: hasanatUseCases.upsertRedemptions,
        responseKey: "redemptions",
        errorMessagePrefix: "redemptions",

        customGetRoute: true,
      });
    },
    { prefix: "/api/hasanat" },
  );

  await fastify.register(hasanatContractRouter);
}
