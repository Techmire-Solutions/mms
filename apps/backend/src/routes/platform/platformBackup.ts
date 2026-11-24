import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { platformBackupExportBodySchema, platformBackupImportBodySchema } from "@mms/contracts";
import {
  authenticatePlatform,
  requirePlatformPermission,
  requirePlatformSuperUser,
  type PlatformAuthenticatedRequest,
} from "../../middleware/authenticatePlatform.js";
import {
  exportPlatformConfigBackup,
  importPlatformConfigBackup,
} from "../../services/platform/platformBackupService.js";
import { verifyPlatformUserPassword } from "../../services/platform/platformUserService.js";
import { parseRequest, replyValidationError } from "../../lib/zodRequest.js";
import { sendForbidden } from "../../lib/httpErrors.js";
import { AUTH_RATE_LIMIT } from "../../lib/rateLimitConfig.js";
import { createStrictRateLimitGuard } from "../../lib/rateLimitGuard.js";
import { insertPlatformActivityLog } from "../../platform/use-cases/platformUseCases.js";

function emailsMatch(input: string, actual: string): boolean {
  return input.trim().toLowerCase() === actual.trim().toLowerCase();
}

/** Platform-configuration backup export/import (super-user + password step-up). */
export default async function platformBackupRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  const strictLimit = createStrictRateLimitGuard(fastify, AUTH_RATE_LIMIT);

  fastify.post(
    "/api/platform/backup/export",
    {
      preHandler: [
        strictLimit,
        authenticatePlatform,
        requirePlatformPermission("settings"),
        requirePlatformSuperUser(),
      ],
      bodyLimit: 8 * 1024,
    },
    async (request, reply) => {
      const parsed = parseRequest(platformBackupExportBodySchema, request.body);
      if (!parsed.ok) return replyValidationError(reply, parsed.message);

      const { platformUser } = request as PlatformAuthenticatedRequest;
      if (!emailsMatch(parsed.data.email, platformUser.email)) {
        return sendForbidden(reply, "Use your own platform email to encrypt the backup");
      }
      const passwordOk = await verifyPlatformUserPassword(platformUser.id, parsed.data.password);
      if (!passwordOk) {
        return reply.status(401).send({
          type: "invalid_current_password",
          message: "Current password is incorrect",
        });
      }

      const { fileName, file } = await exportPlatformConfigBackup({
        adminEmail: platformUser.email,
        password: parsed.data.password,
      });
      await insertPlatformActivityLog({
        userId: platformUser.id,
        userEmail: platformUser.email,
        action: "export_platform_backup",
        targetResource: "platform_backup",
        metadataMessage: "Exported encrypted platform configuration backup",
        ipAddress: request.ip,
      });
      return reply.send({ fileName, file });
    },
  );

  fastify.post(
    "/api/platform/backup/import",
    {
      preHandler: [
        strictLimit,
        authenticatePlatform,
        requirePlatformPermission("settings"),
        requirePlatformSuperUser(),
      ],
      bodyLimit: 64 * 1024 * 1024,
    },
    async (request, reply) => {
      const parsed = parseRequest(platformBackupImportBodySchema, request.body);
      if (!parsed.ok) return replyValidationError(reply, parsed.message);

      const { platformUser } = request as PlatformAuthenticatedRequest;
      if (!emailsMatch(parsed.data.email, platformUser.email)) {
        return sendForbidden(reply, "Use your own platform email to decrypt the backup");
      }
      const passwordOk = await verifyPlatformUserPassword(platformUser.id, parsed.data.password);
      if (!passwordOk) {
        return reply.status(401).send({
          type: "invalid_current_password",
          message: "Current password is incorrect",
        });
      }

      try {
        const result = await importPlatformConfigBackup(parsed.data);
        if (!parsed.data.dryRun) {
          await insertPlatformActivityLog({
            userId: platformUser.id,
            userEmail: platformUser.email,
            action: "import_platform_backup",
            targetResource: "platform_backup",
            metadataMessage: "Applied platform configuration backup",
            ipAddress: request.ip,
          });
        }
        return reply.send(result);
      } catch (error: unknown) {
        const err = error as Error & { statusCode?: number };
        return reply.status(err.statusCode ?? 400).send({
          type: "validation_error",
          message: err.message,
        });
      }
    },
  );
}
