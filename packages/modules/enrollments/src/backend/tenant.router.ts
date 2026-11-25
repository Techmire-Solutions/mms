import { type FastifyInstance, type FastifyPluginOptions } from "fastify";
import { ENROLLMENTS_MODULE_MANIFEST } from "@mms/contracts";
import { registerCountRoute, registerMetricsRoute } from "@mms/be-core/http/crud";

import { enrollmentsUseCases } from "./use-cases/index.js";
import { enrollmentExportRoutes } from "./routes/enrollmentExportRoutes.js";
import { enrollmentImportPreflightRoutes } from "./routes/enrollmentImportPreflightRoutes.js";
import { admissionsRouter } from "./routes/admissionsRouter.js";
import { enrollmentOperationsRouter } from "./routes/enrollmentOperationsRouter.js";
import { enrollmentContractRouter } from "./routes/enrollmentContractRouter.js";

const ENROLLMENTS_COLLECTION = ENROLLMENTS_MODULE_MANIFEST.collectionKey;

/**
 * Enrollments module routes — CRUD, metrics, soft-delete, and column preferences.
 */
export default async function enrollmentsRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  await fastify.register(admissionsRouter);
  await fastify.register(enrollmentOperationsRouter);

  await fastify.register(
    async (sub) => {
      await sub.register(enrollmentExportRoutes);
      await sub.register(enrollmentImportPreflightRoutes);

      registerCountRoute(sub, {
        collection: ENROLLMENTS_COLLECTION,
        loadCountFn: enrollmentsUseCases.countEnrollments,
        errorMessagePrefix: "enrollments",
      });

      registerMetricsRoute(sub, {
        collection: ENROLLMENTS_COLLECTION,
        loadMetricsFn: enrollmentsUseCases.loadEnrollmentsCommandMetrics,
        errorMessagePrefix: "enrollment",
      });
    },
    { prefix: "/api/enrollments" },
  );

  await fastify.register(enrollmentContractRouter);
}
