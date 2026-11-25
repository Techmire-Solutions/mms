import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { WORKSHOPS_MODULE_MANIFEST, workshopsCommandMetricsResponseSchema } from "@mms/contracts";
import { registerMetricsRoute } from "@mms/be-core/http/crud";
import { workshopsUseCases } from "../use-cases/index.js";
import { workshopsContractRouter } from "./workshopsContractRouter.js";
import { workshopsCompletionRouter } from "./workshopsCompletionRouter.js";
import { workshopsExportRoutes } from "./workshopsExportRoutes.js";

/** Workshops module routes: command-centre metrics plus the ts-rest contract. */
export default async function workshopsRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  await fastify.register(
    async (sub) => {
      registerMetricsRoute(sub, {
        collection: WORKSHOPS_MODULE_MANIFEST.collectionKey,
        // `authenticateTenant` already bound the request tenant; `loadMetrics` uses it.
        loadMetricsFn: () => workshopsUseCases.loadMetrics(),
        // The metrics endpoint is outside the ts-rest contract; this is its response schema.
        metricsSchema: workshopsCommandMetricsResponseSchema,
        errorMessagePrefix: "workshops",
      });
    },
    { prefix: WORKSHOPS_MODULE_MANIFEST.restBasePath },
  );

  await fastify.register(workshopsCompletionRouter);
  await fastify.register(workshopsContractRouter);
  await fastify.register(workshopsExportRoutes, { prefix: WORKSHOPS_MODULE_MANIFEST.restBasePath });
}
