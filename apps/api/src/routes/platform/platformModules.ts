import type { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from "fastify";
import {
  platformModulesUpdateSchema,
  platformUserCan,
  type PlatformAdminPermissionKey,
} from "@mms/contracts";
import {
  authenticatePlatform,
  requirePlatformPermission,
  requirePlatformSuperUser,
  type PlatformAuthenticatedRequest,
} from "../../middleware/authenticatePlatform.js";
import { maskPlatformSettingsForClient } from "../../services/platform/platformSettingsService.js";
import {
  getPlatformModuleCatalog,
  updatePlatformModules,
} from "../../services/platform/platformModuleService.js";
import { replyValidationError, parseRequest } from "../../lib/zodRequest.js";
import { sendForbidden } from "../../lib/httpErrors.js";
import { insertPlatformActivityLog } from "../../platform/use-cases/platformUseCases.js";

function requireAnyPlatformPermission(
  permissions: readonly PlatformAdminPermissionKey[],
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request, reply) => {
    const req = request as PlatformAuthenticatedRequest;
    if (!permissions.some((permission) => platformUserCan(req.platformUser, permission))) {
      await sendForbidden(reply, `Missing platform permission: ${permissions.join(" or ")}`);
    }
  };
}

/** Platform module availability + provisioning defaults. */
export default async function platformModuleRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.get(
    "/api/platform/modules/catalog",
    {
      preHandler: [authenticatePlatform, requireAnyPlatformPermission(["settings", "onboard"])],
    },
    async (_request, reply) => {
      return reply.send({ modules: getPlatformModuleCatalog() });
    },
  );

  fastify.put(
    "/api/platform/modules",
    {
      preHandler: [
        authenticatePlatform,
        requirePlatformPermission("settings"),
        requirePlatformSuperUser(),
      ],
    },
    async (request, reply) => {
      const parsed = parseRequest(platformModulesUpdateSchema, request.body);
      if (!parsed.ok) return replyValidationError(reply, parsed.message);

      const { platformUser } = request as PlatformAuthenticatedRequest;
      const settings = await updatePlatformModules(parsed.data);
      await insertPlatformActivityLog({
        userId: platformUser.id,
        userEmail: platformUser.email,
        action: "update_platform_modules",
        targetResource: "platform_modules",
        metadataMessage: `Availability: ${parsed.data.disabledModules.length} disabled, defaults updated`,
        ipAddress: request.ip,
      });
      return reply.send({
        settings: maskPlatformSettingsForClient(settings),
        success: true,
      });
    },
  );
}
