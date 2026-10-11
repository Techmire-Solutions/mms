import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { initServer, type RouterImplementation } from "@ts-rest/fastify";
import { platformSettingsContract } from "@mms/shared";
import type { ContractRouteArgs, ContractRouteResponse } from "../../lib/contractRouterTypes.js";
import {
  authenticatePlatform,
  requirePlatformPermission,
  type PlatformAuthenticatedRequest,
} from "../../middleware/authenticatePlatform.js";
import {
  getPlatformSettings,
  updatePlatformSettings,
} from "../../services/platform/platformSettingsService.js";
import { replyValidationError } from "../../lib/zodRequest.js";
import { insertPlatformActivityLog } from "../../db/repositories/platformActivityLogsRepository.js";

const s = initServer();

export default async function platformSettingsRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.addHook("preHandler", authenticatePlatform);
  fastify.addHook("preHandler", requirePlatformPermission("settings"));

  const router = s.router(platformSettingsContract, {
    getSettings: async (): Promise<
      ContractRouteResponse<(typeof platformSettingsContract)["getSettings"]>
    > => {
      const settings = getPlatformSettings();
      return { status: 200 as const, body: { settings } };
    },

    updateSettings: async ({
      body,
      request,
    }: ContractRouteArgs<(typeof platformSettingsContract)["updateSettings"]>): Promise<
      ContractRouteResponse<(typeof platformSettingsContract)["updateSettings"]>
    > => {
      const settings = await updatePlatformSettings(body);
      const { platformUser } = request as PlatformAuthenticatedRequest;
      await insertPlatformActivityLog({
        userId: platformUser.id,
        userEmail: platformUser.email,
        action: "update_settings",
        targetResource: "settings",
        ipAddress: request.ip,
      });

      return { status: 200 as const, body: { settings, success: true as const } };
    },
  } as unknown as RouterImplementation<typeof platformSettingsContract>);

  await fastify.register(s.plugin(router), {
    requestValidationErrorHandler: (err, _request, reply) => {
      const zErr = err.body ?? err.query ?? err.pathParams ?? err.headers;
      const message = zErr instanceof Error ? zErr.message : err.message;
      void replyValidationError(reply, message);
    },
  });
}
