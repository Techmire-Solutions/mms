import { type FastifyInstance, type FastifyPluginOptions } from "fastify";
import { authenticateTenant } from "../../middleware/authenticate.js";
import { registerModuleAccess } from "../../middleware/requireTenantModule.js";
import { USERS_MODULE_MANIFEST, activityLogListSchema, type User } from "@mms/shared";
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
        // Server-derive the actor, source IP and a bounded timestamp: the body's
        // userId/ip/ts must never be able to forge another user's activity row.
        beforeSave: async (user: User, logs, request) => {
          const now = Date.now();
          return logs.map((log) => {
            const parsed = Date.parse(log.ts);
            const inWindow = Number.isFinite(parsed) && Math.abs(now - parsed) <= 10 * 60 * 1000;
            return {
              ...log,
              userId: String(user.id),
              userName: user.name,
              ip: request.ip,
              ts: inWindow ? new Date(parsed).toISOString() : new Date(now).toISOString(),
            };
          });
        },
        responseKey: "logs",
        errorMessagePrefix: "activity logs",
      });
    },
    { prefix: "/api/users" },
  );

  await fastify.register(userContractRouter);
}
