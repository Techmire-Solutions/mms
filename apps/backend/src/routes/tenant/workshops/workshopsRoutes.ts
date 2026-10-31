import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { WORKSHOPS_MODULE_MANIFEST } from "@mms/shared";
import { authenticateTenant } from "../../../middleware/authenticate.js";
import { registerModuleAccess } from "../../../middleware/requireTenantModule.js";
import { registerMetricsRoute } from "../../../lib/crudRouter.js";
import { runWithTenant } from "../../../lib/tenantContext.js";
import { workshopsUseCases } from "../../../workshops/use-cases/workshopsUseCases.js";
import { workshopsContractRouter } from "./workshopsContractRouter.js";
import { workshopsCompletionRouter } from "./workshopsCompletionRouter.js";

/** Workshops module routes: command-centre metrics plus the ts-rest contract. */
export default async function workshopsRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.addHook("preHandler", authenticateTenant);
  registerModuleAccess(fastify, "workshops");

  await fastify.register(
    async (sub) => {
      registerMetricsRoute(sub, {
        collection: WORKSHOPS_MODULE_MANIFEST.collectionKey,
        loadMetricsFn: (request) =>
          runWithTenant(String(request.tenant?.id ?? ""), () => workshopsUseCases.loadMetrics()),
        errorMessagePrefix: "workshops",
      });
    },
    { prefix: WORKSHOPS_MODULE_MANIFEST.restBasePath },
  );

  await fastify.register(workshopsCompletionRouter);
  await fastify.register(workshopsContractRouter);
}
