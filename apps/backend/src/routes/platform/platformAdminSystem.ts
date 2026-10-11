import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
  type MigrateAndRestartAccepted,
  migrateAndRestartSchema,
  platformActivityLogsQuerySchema,
} from "@mms/shared";
import {
  authenticatePlatform,
  requirePlatformPermission,
  requirePlatformSuperUser,
  type PlatformAuthenticatedRequest,
} from "../../middleware/authenticatePlatform.js";
import { parseRequest, replyValidationError } from "../../lib/zodRequest.js";
import { sendInvalidCurrentPassword } from "../../lib/httpErrors.js";
import { AUTH_RATE_LIMIT } from "../../lib/rateLimitConfig.js";
import { createStrictRateLimitGuard } from "../../lib/rateLimitGuard.js";
import {
  insertPlatformActivityLog,
  listPlatformActivityLogs,
} from "../../db/repositories/platformActivityLogsRepository.js";
import { verifyPlatformUserPassword } from "../../services/platform/platformUserService.js";
import {
  isRemoteMigrateRestartEnabled,
  MIGRATE_RESTART_DELAY_MS,
  scheduleMigrateAndRestart,
} from "../../services/platform/platformAdminService.js";
import {
  getPlatformTelemetry,
  getPlatformActivityTrend,
} from "../../services/platform/platformTelemetryService.js";

/**
 * Platform apex system ops — full initDb (DDL + data migrations) + PM2 reload.
 * Restricted to `super_user` with password step-up and explicit env opt-in.
 */
export default async function platformAdminSystemRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  await fastify.register(async function platformAdminSystemRoutesScoped(inner) {
    // Apply the strict limit only to the destructive migrate-and-restart route.
    // Read endpoints (activity-logs / telemetry / activity-trend) are polled by
    // the platform dashboard and must stay on the global limiter.
    inner.post(
      "/migrate-and-restart",
      {
        preHandler: [
          createStrictRateLimitGuard(inner, AUTH_RATE_LIMIT),
          authenticatePlatform,
          requirePlatformPermission("system"),
          requirePlatformSuperUser(),
        ],
      },
      async (request, reply) => {
        if (!isRemoteMigrateRestartEnabled()) {
          return reply.status(403).send({
            type: "remote_migrate_disabled",
            message:
              "Remote migrate-and-restart is disabled. Set PLATFORM_ALLOW_REMOTE_MIGRATE_RESTART=true on the server.",
          });
        }

        const parsed = parseRequest(migrateAndRestartSchema, request.body ?? {});
        if (!parsed.ok) return replyValidationError(reply, parsed.message);

        const { platformUser } = request as PlatformAuthenticatedRequest;
        const passwordOk = await verifyPlatformUserPassword(platformUser.id, parsed.data.password);
        if (!passwordOk) {
          return sendInvalidCurrentPassword(reply);
        }

        const scheduled = scheduleMigrateAndRestart({
          userId: platformUser.id,
        });

        if (!scheduled) {
          return reply.status(409).send({
            type: "migrate_restart_in_progress",
            message: "A migrate-and-restart is already in progress.",
          });
        }

        await insertPlatformActivityLog({
          userId: platformUser.id,
          userEmail: platformUser.email,
          action: "migrate_and_restart",
          targetResource: "system",
          metadataMessage: `Scheduled migrate-and-restart (delay=${MIGRATE_RESTART_DELAY_MS}ms)`,
          ipAddress: request.ip,
        });

        // Acknowledge before migrate/reload so the client is not dropped mid-response.
        const body: MigrateAndRestartAccepted = {
          success: true,
          accepted: true,
          message:
            "Migrate and restart accepted. Database migrations will run, then the backend will reload shortly.",
          delayMs: MIGRATE_RESTART_DELAY_MS,
        };
        return reply.status(200).send(body);
      },
    );

    inner.get(
      "/activity-logs",
      { preHandler: [authenticatePlatform, requirePlatformPermission("system")] },
      async (request, reply) => {
        const parsed = parseRequest(platformActivityLogsQuerySchema, request.query ?? {});
        if (!parsed.ok) return replyValidationError(reply, parsed.message);
        const { limit, offset } = parsed.data;
        const logs = await listPlatformActivityLogs(limit, offset);
        return reply.send({ logs });
      },
    );

    inner.get(
      "/telemetry",
      { preHandler: [authenticatePlatform, requirePlatformPermission("system")] },
      async (_request, reply) => {
        const telemetry = await getPlatformTelemetry();
        return reply.send(telemetry);
      },
    );

    inner.get(
      "/activity-trend",
      { preHandler: [authenticatePlatform, requirePlatformPermission("system")] },
      async (_request, reply) => {
        const trend = await getPlatformActivityTrend(6);
        return reply.send({ trend });
      },
    );
  });
}
