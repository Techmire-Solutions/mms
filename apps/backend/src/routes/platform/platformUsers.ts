import type { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from "fastify";
import { initServer, type RouterImplementation } from "@ts-rest/fastify";
import { platformAdminsContract } from "@mms/shared";
import {
  authenticatePlatform,
  requirePlatformPermission,
  requirePlatformSuperUser,
} from "../../middleware/authenticatePlatform.js";
import { replyValidationError } from "../../lib/zodRequest.js";
import { AUTH_RATE_LIMIT } from "../../lib/rateLimitConfig.js";
import { createStrictRateLimitGuard } from "../../lib/rateLimitGuard.js";
import {
  handleListAdmins,
  handleCreateAdmin,
  handleUpdateAdminPermissions,
  handleVerifyAdminEmail,
  handleSetAdminDisabled,
  handleDeleteAdmin,
} from "./platformUsersHandlers.js";

const s = initServer();

export default async function platformUsersRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  const authRateLimit = createStrictRateLimitGuard(fastify, AUTH_RATE_LIMIT);

  fastify.addHook("preHandler", authenticatePlatform);
  fastify.addHook("preHandler", requirePlatformPermission("admins"));

  const router = s.router(platformAdminsContract, {
    listAdmins: handleListAdmins,

    createAdmin: {
      hooks: {
        preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
          await authRateLimit(request, reply);
          if (reply.sent) return;
          await requirePlatformSuperUser()(request, reply);
        },
      },
      handler: handleCreateAdmin,
    },

    updateAdminPermissions: {
      hooks: {
        preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
          await authRateLimit(request, reply);
          if (reply.sent) return;
          await requirePlatformSuperUser()(request, reply);
        },
      },
      handler: handleUpdateAdminPermissions,
    },

    verifyAdminEmail: handleVerifyAdminEmail,

    setAdminDisabled: {
      hooks: {
        preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
          await authRateLimit(request, reply);
        },
      },
      handler: handleSetAdminDisabled,
    },

    deleteAdmin: {
      hooks: {
        preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
          await authRateLimit(request, reply);
        },
      },
      handler: handleDeleteAdmin,
    },
  } as unknown as RouterImplementation<typeof platformAdminsContract>);

  await fastify.register(s.plugin(router), {
    requestValidationErrorHandler: (err, _request, reply) => {
      const zErr = err.body ?? err.query ?? err.pathParams ?? err.headers;
      const message = zErr instanceof Error ? zErr.message : err.message;
      void replyValidationError(reply, message);
    },
  });
}
