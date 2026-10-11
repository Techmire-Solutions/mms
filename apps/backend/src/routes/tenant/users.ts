import { type FastifyInstance, type FastifyPluginOptions } from "fastify";
import { authenticateTenant } from "../../middleware/authenticate.js";
import { registerModuleAccess } from "../../middleware/requireTenantModule.js";
import { USERS_MODULE_MANIFEST, activityLogListSchema } from "@mms/shared";
import {
  registerBulkRoutes,
  registerCountRoute,
  registerMetricsRoute,
} from "../../lib/crudRouter.js";

import { usersUseCases } from "../../users/use-cases/usersUseCases.js";
import { userExportRoutes } from "./users/userExportRoutes.js";
import { userSetupConfigRoutes } from "./users/userSetupConfigRoutes.js";
import { userContractRouter } from "./users/userContractRouter.js";

const USERS_COLLECTION = USERS_MODULE_MANIFEST.collectionKey;
const LOGS_COLLECTION = "user_activity_logs";

/**
 * Users module routes — workspace users CRUD, soft-delete, activity logs, column preferences.
 */
export default async function usersRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.addHook("preHandler", authenticateTenant);
  registerModuleAccess(fastify, "users");

  await fastify.register(
    async (sub) => {
      await sub.register(userSetupConfigRoutes);
      await sub.register(userExportRoutes);

      registerMetricsRoute(sub, {
        collection: USERS_COLLECTION,
        errorMessagePrefix: "workspace users",
        loadMetricsFn: usersUseCases.loadUsersCommandMetrics,
      });

      registerCountRoute(sub, {
        path: "/count",
        collection: USERS_COLLECTION,
        loadCountFn: usersUseCases.countUsers,
        errorMessagePrefix: "workspace users",
      });

      registerBulkRoutes(sub, {
        path: "/activity",
        collection: LOGS_COLLECTION,
        schema: activityLogListSchema,
        loadFn: usersUseCases.loadLogs,
        saveFn: usersUseCases.upsertLogs,
        responseKey: "logs",
        errorMessagePrefix: "activity logs",
      });
    },
    { prefix: "/api/users" },
  );

  await fastify.register(userContractRouter);
}
