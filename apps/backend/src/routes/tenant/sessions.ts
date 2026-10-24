import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { SESSIONS_MODULE_MANIFEST } from "@mms/shared";
import { authenticateTenant } from "../../middleware/authenticate.js";
import { registerModuleAccess } from "../../middleware/requireTenantModule.js";
import { sessionsUseCases } from "../../sessions/use-cases/sessionsUseCases.js";
import { registerStandardExtendedRoutes } from "../../lib/crudRouter.js";
import { sessionContractRouter } from "./sessions/sessionContractRouter.js";
import { academicCatalogRouter } from "./sessions/academicCatalogRouter.js";
import { registrationLinksRouter } from "./sessions/registrationLinksRouter.js";
import { sessionSectionsRouter } from "./sessions/sessionSectionsRouter.js";
import { sessionLifecycleOpsRouter } from "./sessions/sessionLifecycleOpsRouter.js";
import { sessionRolloverRouter } from "./sessions/sessionRolloverRouter.js";
import { sessionCompletionRouter } from "./sessions/sessionCompletionRouter.js";

const COLLECTION = SESSIONS_MODULE_MANIFEST.collectionKey;

/**
 * Sessions routes — all contract keys served via @ts-rest contract router.
 * Count and metrics remain on raw Fastify (`registerStandardExtendedRoutes`).
 */
export default async function sessionsRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.addHook("preHandler", authenticateTenant);
  registerModuleAccess(fastify, "sessions");

  // Count + Metrics (not in sessionContract)
  await fastify.register(
    async (sub) => {
      registerStandardExtendedRoutes(sub, {
        collection: COLLECTION,
        errorMessagePrefix: "sessions",
        nameSingular: "session",
        loadCountFn: sessionsUseCases.countSessions,
        loadMetricsFn: sessionsUseCases.loadSessionsCommandMetrics,
      });
    },
    { prefix: "/api/sessions" },
  );

  await fastify.register(sessionContractRouter);
  await fastify.register(academicCatalogRouter);
  await fastify.register(registrationLinksRouter);
  await fastify.register(sessionSectionsRouter);
  await fastify.register(sessionLifecycleOpsRouter);
  await fastify.register(sessionRolloverRouter);
  await fastify.register(sessionCompletionRouter);
}
