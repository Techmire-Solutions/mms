import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { initServer, type RouterImplementation } from "@ts-rest/fastify";
import { platformBrandingContract } from "@mms/contracts";
import type { ContractRouteArgs, ContractRouteResponse } from "@mms/be-core/http/routes";
import { authenticatePlatform, requirePlatformPermission } from "../deps.js";
import {
  getPlatformBranding,
  savePlatformAppearance,
} from "../services/platformBrandingService.js";
import { replyValidationError } from "@mms/be-core/http/routes";
import { insertPlatformActivityLog } from "../use-cases/platformUseCases.js";

const s = initServer();

export default async function platformBrandingRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.addHook("preHandler", authenticatePlatform);
  fastify.addHook("preHandler", requirePlatformPermission("settings"));

  const router = s.router(platformBrandingContract, {
    getBranding: async (): Promise<
      ContractRouteResponse<(typeof platformBrandingContract)["getBranding"]>
    > => {
      return { status: 200 as const, body: { branding: getPlatformBranding() } };
    },

    updateBranding: async ({
      body,
      request,
    }: ContractRouteArgs<(typeof platformBrandingContract)["updateBranding"]>): Promise<
      ContractRouteResponse<(typeof platformBrandingContract)["updateBranding"]>
    > => {
      const result = await savePlatformAppearance(body);
      if (!result.ok) {
        return {
          status: 409 as const,
          body: {
            type: "conflict",
            message: "Platform branding changed elsewhere. Reload and try again.",
          },
        };
      }

      const { platformUser } = request as any;
      const changed = [
        body.branding ? "branding" : null,
        body.themeMode !== undefined ? "themeMode" : null,
      ].filter(Boolean) as string[];
      await insertPlatformActivityLog({
        userId: platformUser.id,
        userEmail: platformUser.email,
        action: "update_platform_branding",
        targetResource: "platform_branding",
        metadataMessage: `Updated ${changed.join(" + ")}`,
        ipAddress: request.ip,
      });

      return {
        status: 200 as const,
        body: { branding: result.branding, success: true as const },
      };
    },
  } as unknown as RouterImplementation<typeof platformBrandingContract>);

  await fastify.register(s.plugin(router), {
    requestValidationErrorHandler: (err, _request, reply) => {
      const zErr = err.body ?? err.query ?? err.pathParams ?? err.headers;
      const message = zErr instanceof Error ? zErr.message : err.message;
      void replyValidationError(reply, message);
    },
  });
}
