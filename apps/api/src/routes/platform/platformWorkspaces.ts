import type { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from "fastify";
import { initServer, type RouterImplementation } from "@ts-rest/fastify";
import { platformWorkspacesContract } from "@mms/contracts";
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
  handleRenameWorkspace,
} from "./platformWorkspaceOpsHandlers.js";

const s = initServer();

export default async function platformWorkspaceRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  const breakGlassRateLimit = createStrictRateLimitGuard(fastify, AUTH_RATE_LIMIT);

  /** Super-user-only guard for break-glass / destructive platform operations. */
  const requireSuperUser = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (reply.sent) return;
    const req = request as PlatformAuthenticatedRequest;
    if (req.platformUser?.role !== "super_user") {
      void reply.status(403).send({ type: "forbidden", message: "Super-user privilege required" });
    }
  };

  fastify.addHook("preHandler", authenticatePlatform);
  fastify.addHook("preHandler", requirePlatformPermission("workspaces"));

  const router = s.router(platformWorkspacesContract, {
    listWorkspaces: handleListWorkspaces,
    getWorkspaceMetrics: handleGetWorkspaceMetrics,
    patchWorkspace: handlePatchWorkspace,
    getWorkspaceModules: handleGetWorkspaceModules,
    updateWorkspaceModules: handleUpdateWorkspaceModules,
    patchWorkspaceEmailVerification: handlePatchWorkspaceEmailVerification,
    renameWorkspace: handleRenameWorkspace,
    verifyTenantUserEmail: handleVerifyTenantUserEmail,
    resetWorkspaceAdminPassword: {
      hooks: {
        preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
          await breakGlassRateLimit(request, reply);
          await requireSuperUser(request, reply);
        },
      },
      handler: handleResetWorkspaceAdminPassword,
    },
    createWorkspaceAdminUser: {
      hooks: {
        preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
          await breakGlassRateLimit(request, reply);
          await requireSuperUser(request, reply);
        },
      },
      handler: handleCreateWorkspaceAdminUser,
    },
    deleteWorkspace: {
      hooks: {
        preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
          await breakGlassRateLimit(request, reply);
          await requireSuperUser(request, reply);
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
