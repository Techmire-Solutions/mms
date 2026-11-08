import { type FastifyInstance, type FastifyPluginOptions } from "fastify";
import { authenticateTenant } from "../../middleware/authenticate.js";
import { registerModuleAccess } from "../../middleware/requireTenantModule.js";
import { ENROLLMENTS_MODULE_MANIFEST } from "@mms/shared";
import { registerCountRoute, registerMetricsRoute } from "../../lib/crudRouter.js";

import { enrollmentsUseCases } from "../../enrollments/use-cases/enrollmentsUseCases.js";
import { enrollmentExportRoutes } from "./enrollments/enrollmentExportRoutes.js";
import { enrollmentImportPreflightRoutes } from "./enrollments/enrollmentImportPreflightRoutes.js";
import { admissionsRouter } from "./enrollments/admissionsRouter.js";
import { enrollmentOperationsRouter } from "./enrollments/enrollmentOperationsRouter.js";
import { enrollmentContractRouter } from "./enrollments/enrollmentContractRouter.js";

const ENROLLMENTS_COLLECTION = ENROLLMENTS_MODULE_MANIFEST.collectionKey;

/**
 * Enrollments module routes — CRUD, metrics, soft-delete, and column preferences.
 */
export default async function enrollmentsRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.addHook("preHandler", authenticateTenant);
  registerModuleAccess(fastify, "enrollment");
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
