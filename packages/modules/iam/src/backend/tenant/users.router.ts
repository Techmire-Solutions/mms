import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { USERS_MODULE_MANIFEST, activityLogListSchema, type User } from "@mms/contracts";
import {
  registerBulkRoutes,
  registerCountRoute,
  registerMetricsRoute,
} from "@mms/be-core/http/crud";

import { usersUseCases } from "./use-cases/usersUseCases.js";
import { userExportRoutes } from "./routes/userExportRoutes.js";
import { userSetupConfigRoutes } from "./routes/userSetupConfigRoutes.js";
import { userContractRouter } from "./routes/userContractRouter.js";

const USERS_COLLECTION = USERS_MODULE_MANIFEST.collectionKey;
const LOGS_COLLECTION = "user_activity_logs";

/**
 * Users module routes — workspace users CRUD, soft-delete, activity logs, column preferences.
 */
export default async function usersRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
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
        // `action`/`module`/`detail`/`id` remain client-supplied by design — this
        // is the client-synced activity feed; the tamper-evident audit trail is
        // produced server-side via recordUserActivityLog / recordModernAuditEvent.
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
