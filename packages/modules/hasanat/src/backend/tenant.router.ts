import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { HASANAT_MODULE_MANIFEST, hasanatCommandMetricsResponseSchema } from "@mms/contracts";
import { registerMetricsRoute } from "@mms/be-core/http/crud";
import { hasanatUseCases } from "./use-cases/index.js";
import { hasanatSetupConfigRoutes } from "./routes/hasanatSetupConfigRoutes.js";
import { hasanatContractRouter } from "./routes/hasanatContractRouter.js";
import { hasanatExportRoutes } from "./routes/hasanatExportRoutes.js";

const HASANAT_DISTRIBUTIONS_COLLECTION = HASANAT_MODULE_MANIFEST.collectionKey;

/**
 * Hasanat module routes — contract router (cards, setup lists, reports) plus the setup-config,
 * CSV export/import and metrics endpoints that are shared infrastructure.
 */
export default async function hasanatRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
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
