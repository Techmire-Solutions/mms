import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { SESSIONS_MODULE_MANIFEST, sessionsCommandMetricsResponseSchema } from "@mms/contracts";
import { sessionsUseCases } from "./use-cases/index.js";
import { registerStandardExtendedRoutes } from "@mms/be-core/http/crud";
import { sessionContractRouter } from "./routes/sessionContractRouter.js";
import { academicCatalogRouter } from "./routes/academicCatalogRouter.js";
import { registrationLinksRouter } from "./routes/registrationLinksRouter.js";
import { sessionSectionsRouter } from "./routes/sessionSectionsRouter.js";
import { sessionLifecycleOpsRouter } from "./routes/sessionLifecycleOpsRouter.js";
import { sessionRolloverRouter } from "./routes/sessionRolloverRouter.js";
import { sessionCompletionRouter } from "./routes/sessionCompletionRouter.js";
import { sessionExportRoutes } from "./routes/sessionExportRoutes.js";
import { sessionCalendarExportRoutes } from "./routes/sessionCalendarExportRoutes.js";
import { sessionTimetableImportRoutes } from "./routes/sessionTimetableImportRoutes.js";

const COLLECTION = SESSIONS_MODULE_MANIFEST.collectionKey;

/**
 * Sessions routes — all contract keys served via @ts-rest contract router.
 * Count and metrics remain on raw Fastify (`registerStandardExtendedRoutes`).
 */
export default async function sessionsRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  // Count + Metrics (not in sessionContract)
  await fastify.register(
    async (sub) => {
      registerStandardExtendedRoutes(sub, {
        collection: COLLECTION,
        errorMessagePrefix: "sessions",
        nameSingular: "session",
        loadCountFn: sessionsUseCases.countSessions,
        loadMetricsFn: sessionsUseCases.loadSessionsCommandMetrics,
        metricsSchema: sessionsCommandMetricsResponseSchema,
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
  // Raw Fastify route (ts-rest contract carries no export/csv endpoint).
  await fastify.register(sessionExportRoutes, { prefix: "/api/sessions" });
  await fastify.register(sessionCalendarExportRoutes, { prefix: "/api/sessions" });
  await fastify.register(sessionTimetableImportRoutes, { prefix: "/api/sessions" });
}
