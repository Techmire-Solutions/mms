import type { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from "fastify";
import { initServer, type RouterImplementation } from "@ts-rest/fastify";
import { platformWorkspacesContract } from "@mms/shared";
import {
  authenticatePlatform,
  requirePlatformPermission,
  type PlatformAuthenticatedRequest,
} from "../../middleware/authenticatePlatform.js";
import { replyValidationError } from "../../lib/zodRequest.js";
import { AUTH_RATE_LIMIT } from "../../lib/rateLimitConfig.js";
import { createStrictRateLimitGuard } from "../../lib/rateLimitGuard.js";
import {
  handleVerifyTenantUserEmail,
  handleResetWorkspaceAdminPassword,
  handleCreateWorkspaceAdminUser,
} from "./platformWorkspaceAdminHandlers.js";
import {
  handleListWorkspaces,
  handleGetWorkspaceMetrics,
  handlePatchWorkspace,
  handleGetWorkspaceModules,
  handleUpdateWorkspaceModules,
  handlePatchWorkspaceEmailVerification,
  handleDeleteWorkspace,
} from "./platformWorkspaceOpsHandlers.js";

const s = initServer();

export default async function platformWorkspaceRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  const breakGlassRateLimit = createStrictRateLimitGuard(fastify, AUTH_RATE_LIMIT);

  fastify.addHook("preHandler", authenticatePlatform);
  fastify.addHook("preHandler", requirePlatformPermission("workspaces"));

  const router = s.router(platformWorkspacesContract, {
    listWorkspaces: handleListWorkspaces,
    getWorkspaceMetrics: handleGetWorkspaceMetrics,
    patchWorkspace: handlePatchWorkspace,
    getWorkspaceModules: handleGetWorkspaceModules,
    updateWorkspaceModules: handleUpdateWorkspaceModules,
    patchWorkspaceEmailVerification: handlePatchWorkspaceEmailVerification,
    verifyTenantUserEmail: handleVerifyTenantUserEmail,
    resetWorkspaceAdminPassword: {
      hooks: {
        preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
          await breakGlassRateLimit(request, reply);
        },
      },
      handler: handleResetWorkspaceAdminPassword,
    },
    createWorkspaceAdminUser: {
      hooks: {
        preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
          await breakGlassRateLimit(request, reply);
        },
      },
      handler: handleCreateWorkspaceAdminUser,
    },
    deleteWorkspace: {
      hooks: {
        preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
          await breakGlassRateLimit(request, reply);
          if (reply.sent) return;
          const req = request as PlatformAuthenticatedRequest;
          if (req.platformUser?.role !== "super_user") {
            return reply
              .status(403)
              .send({ type: "forbidden", message: "Super-user privilege required" });
          }
        },
      },
      handler: handleDeleteWorkspace,
    },
  } as unknown as RouterImplementation<typeof platformWorkspacesContract>);

  await fastify.register(s.plugin(router), {
    requestValidationErrorHandler: (err, _request, reply) => {
      const zErr = err.body ?? err.query ?? err.pathParams ?? err.headers;
      const message = zErr instanceof Error ? zErr.message : err.message;
      void replyValidationError(reply, message);
    },
  });
}
