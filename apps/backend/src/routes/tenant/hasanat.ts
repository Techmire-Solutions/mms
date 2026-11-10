import { type FastifyInstance, type FastifyPluginOptions } from "fastify";
import { authenticateTenant } from "../../middleware/authenticate.js";
import { registerModuleAccess } from "../../middleware/requireTenantModule.js";
import { HASANAT_MODULE_MANIFEST, hasanatCommandMetricsResponseSchema } from "@mms/shared";
import { registerMetricsRoute } from "../../lib/crudRouter.js";
import { hasanatUseCases } from "../../hasanat/use-cases/hasanatUseCases.js";
import { registerHasanatBulkAwardRunner } from "../../hasanat/use-cases/hasanatBatchAwardJob.js";
import { registerHasanatImportRunner } from "../../hasanat/use-cases/hasanatImportJob.js";
import { hasanatSetupConfigRoutes } from "./hasanatSetupConfigRoutes.js";
import { hasanatContractRouter } from "./hasanat/hasanatContractRouter.js";
import { hasanatExportRoutes } from "./hasanat/hasanatExportRoutes.js";

const HASANAT_DISTRIBUTIONS_COLLECTION = HASANAT_MODULE_MANIFEST.collectionKey;

/**
 * Hasanat module routes — contract router (cards, setup lists, reports) plus the setup-config,
 * CSV export/import and metrics endpoints that are shared infrastructure.
 */
export default async function hasanatRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.addHook("preHandler", authenticateTenant);
  registerModuleAccess(fastify, "hasanat");
  // Queue runner for groups above the inline cap (idempotent per process).
  registerHasanatBulkAwardRunner();
  registerHasanatImportRunner();

  await fastify.register(
    async (sub) => {
      await sub.register(hasanatSetupConfigRoutes);
      await sub.register(hasanatExportRoutes);

      registerMetricsRoute(sub, {
        collection: HASANAT_DISTRIBUTIONS_COLLECTION,
        loadMetricsFn: hasanatUseCases.loadHasanatCommandMetrics,
        errorMessagePrefix: "hasanat",
        metricsSchema: hasanatCommandMetricsResponseSchema,
      });
    },
    { prefix: "/api/hasanat" },
  );

  await fastify.register(hasanatContractRouter);
}
