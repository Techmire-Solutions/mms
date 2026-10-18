import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { User, WorkspaceUser } from "@mms/shared";
import { isQueryFlagTrue, userContract } from "@mms/shared";
import { initServer, type RouterImplementation } from "@ts-rest/fastify";
import { standardRequestValidationErrorHandler } from "../../../lib/contractRegistration.js";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import {
  canReadCollection,
  canWriteCollection,
  canDeleteCollection,
} from "../../../services/rbacService.js";
import { usersUseCases } from "../../../users/use-cases/usersUseCases.js";
import { AUTH_RATE_LIMIT } from "../../../lib/rateLimitConfig.js";
import { createStrictRateLimitGuard } from "../../../lib/rateLimitGuard.js";
import { resolveRequestOrigin } from "../../../lib/requestHost.js";
import {
  dependencyForDiagnosticStage,
  getRequestDiagnosticContext,
  getRuntimeDependencySnapshot,
  markRequestDiagnosticStage,
  startRequestDiagnostics,
} from "../../../lib/requestDiagnostics.js";
import { isUniqueViolation } from "../../../lib/pgErrors.js";

const s = initServer();

function handleUserRouterError(
  err: unknown,
  request: FastifyRequest,
  fallbackMessage: string,
  context: Record<string, string> = {},
) {
  const error = err as Error & {
    statusCode?: number;
    type?: string;
    passwordResetStage?: string;
  };
  if (error.statusCode === 404) {
    return {
      status: 404 as const,
      body: { type: "not_found", message: error.message || "User not found" },
    };
  }
  if (error.statusCode === 403) {
    return {
      status: 403 as const,
      body: { type: error.type ?? "forbidden", message: error.message },
    };
  }
  if (error.statusCode === 400) {
    return {
      status: 400 as const,
      body: { type: error.type ?? "validation_error", message: error.message },
    };
  }
  if (error.statusCode === 409 || isUniqueViolation(err)) {
    return {
      status: 409 as const,
      body: {
        type: "conflict",
        message: error.message || "A record with this unique identifier already exists",
      },
    };
  }
  const diagnostic = getRequestDiagnosticContext(request);
  const failureStage = error.passwordResetStage ?? diagnostic?.stage;
  const dependency = dependencyForDiagnosticStage(failureStage);
  if (error.passwordResetStage) {
    markRequestDiagnosticStage(request, error.passwordResetStage);
  }
  request.log.error(
    {
      err,
      requestId: request.id,
      method: request.method,
      url: request.url,
      failureStage,
      dependency,
      ...(diagnostic ? { runtimeDependencies: getRuntimeDependencySnapshot() } : {}),
      ...context,
    },
    fallbackMessage,
  );

  const stageMessage = failureStage ? ` during ${failureStage.replaceAll("_", " ")}` : "";
  return {
    status: 500 as const,
    body: {
      type: error.type === "password_reset_failed" ? error.type : "database_error",
      message: `${fallbackMessage}${stageMessage}. Reference: ${request.id}`,
      requestId: request.id,
      ...(failureStage ? { stage: failureStage } : {}),
      ...(dependency ? { dependency } : {}),
    },
  };
}

export const userContractRouter: FastifyPluginAsync = async (fastify) => {
  const resetPasswordRateLimit = createStrictRateLimitGuard(fastify, AUTH_RATE_LIMIT);
  const router = s.router(userContract, {
    list: async ({
      query,
      request,
    }: ContractRouteArgs<(typeof userContract)["list"]>): Promise<
      ContractRouteResponse<(typeof userContract)["list"]>
    > => {
      const user = request.user as User;
      if (!canReadCollection(user, "users")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      const includeDeleted = isQueryFlagTrue(query?.includeDeleted);
      if (includeDeleted && !canDeleteCollection(user, "users")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const result = await usersUseCases.loadUsersPage({
          ...query,
          includeDeleted,
        });
        return { status: 200 as const, body: result };
      } catch (err) {
        return handleUserRouterError(err, request, "Failed to list users");
      }
    },
    create: async ({
      body,
      request,
    }: ContractRouteArgs<(typeof userContract)["create"]>): Promise<
      ContractRouteResponse<(typeof userContract)["create"]>
    > => {
      const user = request.user as User;
      if (!canWriteCollection(user, "users")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const {
          user: created,
          inviteEmailSent,
          inviteEmailError,
        } = await usersUseCases.createWorkspaceUser(
          body,
          String(user.id),
          user.role,
          request.ip,
          resolveRequestOrigin(request),
        );
        return { status: 200 as const, body: { user: created, inviteEmailSent, inviteEmailError } };
      } catch (err: unknown) {
        return handleUserRouterError(err, request, "Failed to create workspace user");
      }
    },
    update: async ({
      params: { id },
      body,
      request,
    }: ContractRouteArgs<(typeof userContract)["update"]>): Promise<
      ContractRouteResponse<(typeof userContract)["update"]>
    > => {
      const user = request.user as User;
      if (!canWriteCollection(user, "users")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const updated = await usersUseCases.updateWorkspaceUser(
          id,
          body,
          String(user.id),
          user.role,
          request.ip,
        );
        return { status: 200 as const, body: { user: updated } };
      } catch (err: unknown) {
        return handleUserRouterError(err, request, "Failed to update workspace user");
      }
    },
    invite: async ({
      body,
      request,
    }: ContractRouteArgs<(typeof userContract)["invite"]>): Promise<
      ContractRouteResponse<(typeof userContract)["invite"]>
    > => {
      const user = request.user as User;
      if (!canWriteCollection(user, "users")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const {
          user: invited,
          inviteEmailSent,
          inviteEmailError,
        } = await usersUseCases.inviteWorkspaceUser(
          body,
          String(user.id),
          user.role,
          request.ip,
          resolveRequestOrigin(request),
        );
        return { status: 200 as const, body: { user: invited, inviteEmailSent, inviteEmailError } };
      } catch (err: unknown) {
        return handleUserRouterError(err, request, "Failed to invite workspace user");
      }
    },
    bulkUpdate: async ({
      body,
      request,
    }: ContractRouteArgs<(typeof userContract)["bulkUpdate"]>): Promise<
      ContractRouteResponse<(typeof userContract)["bulkUpdate"]>
    > => {
      const user = request.user as User;
      if (!canWriteCollection(user, "users")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const updated = await usersUseCases.upsertWorkspaceUsers(
          body as WorkspaceUser[],
          user.role,
        );
        return { status: 200 as const, body: { users: updated } };
      } catch (err: unknown) {
        return handleUserRouterError(err, request, "Failed to update workspace users");
      }
    },
    bulkDelete: async ({
      body,
      request,
    }: ContractRouteArgs<(typeof userContract)["bulkDelete"]>): Promise<
      ContractRouteResponse<(typeof userContract)["bulkDelete"]>
    > => {
      const user = request.user as User;
      if (!canDeleteCollection(user, "users")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const result = await usersUseCases.bulkSoftDeleteUsers(
          body.ids.map(String),
          String(user.id),
          user.role,
        );
        return { status: 200 as const, body: { success: true, ...result } };
      } catch (err: unknown) {
        return handleUserRouterError(err, request, "Failed to bulk delete users");
      }
    },
    bulkRestore: async ({
      body,
      request,
    }: ContractRouteArgs<(typeof userContract)["bulkRestore"]>): Promise<
      ContractRouteResponse<(typeof userContract)["bulkRestore"]>
    > => {
      const user = request.user as User;
      if (!canDeleteCollection(user, "users")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const result = await usersUseCases.bulkRestoreUsers(
          body.ids.map(String),
          user.role,
          String(user.id),
          request.ip,
        );
        return { status: 200 as const, body: { success: true, ...result } };
      } catch (err: unknown) {
        return handleUserRouterError(err, request, "Failed to bulk restore users");
      }
    },
    delete: async ({
      params: { id },
      request,
    }: ContractRouteArgs<(typeof userContract)["delete"]>): Promise<
      ContractRouteResponse<(typeof userContract)["delete"]>
    > => {
      const user = request.user as User;
      if (!canDeleteCollection(user, "users")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const ok = await usersUseCases.deleteUserById(id, String(user.id), user.role);
        if (!ok)
          return { status: 404 as const, body: { type: "not_found", message: "User not found" } };
        return { status: 200 as const, body: { success: true } };
      } catch (error: unknown) {
        return handleUserRouterError(error, request, "Failed to delete user");
      }
    },
    restore: async ({
      params: { id },
      request,
    }: ContractRouteArgs<(typeof userContract)["restore"]>): Promise<
      ContractRouteResponse<(typeof userContract)["restore"]>
    > => {
      const user = request.user as User;
      if (!canDeleteCollection(user, "users")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const ok = await usersUseCases.restoreUserById(id, user.role, String(user.id), request.ip);
        if (!ok)
          return { status: 404 as const, body: { type: "not_found", message: "User not found" } };
        return { status: 200 as const, body: { success: true } };
      } catch (err: unknown) {
        return handleUserRouterError(err, request, "Failed to restore user");
      }
    },
    verifyEmail: async ({
      params: { id },
      request,
    }: ContractRouteArgs<(typeof userContract)["verifyEmail"]>): Promise<
      ContractRouteResponse<(typeof userContract)["verifyEmail"]>
    > => {
      const user = request.user as User;
      if (!canWriteCollection(user, "users")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const ok = await usersUseCases.verifyUserEmailById(id, user.role);
        if (!ok)
          return { status: 404 as const, body: { type: "not_found", message: "User not found" } };
        return { status: 200 as const, body: { success: true } };
      } catch (err: unknown) {
        return handleUserRouterError(err, request, "Failed to verify user email");
      }
    },
    resetPassword: {
      hooks: {
        onRequest: async (request: FastifyRequest) => {
          startRequestDiagnostics(request, "users.reset_password");
        },
        preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
          markRequestDiagnosticStage(request, "rate_limit");
          await resetPasswordRateLimit(request, reply);
        },
      },
      handler: async ({
        params: { id },
        body,
        request,
      }: ContractRouteArgs<(typeof userContract)["resetPassword"]>): Promise<
        ContractRouteResponse<(typeof userContract)["resetPassword"]>
      > => {
        let actorUserId = "unknown";
        try {
          markRequestDiagnosticStage(request, "authorization");
          const user = request.user as User;
          actorUserId = user?.id == null ? "unknown" : String(user.id);
          if (!canWriteCollection(user, "users")) {
            return {
              status: 403 as const,
              body: { type: "forbidden", message: "Insufficient permissions" },
            };
          }
          if (actorUserId === id) {
            return {
              status: 400 as const,
              body: {
                type: "self_password_reset",
                message: "Use profile security settings to change your own password",
              },
            };
          }
          markRequestDiagnosticStage(request, "password_reset");
          const ok = await usersUseCases.resetUserPasswordById(
            id,
            body.temporaryPassword,
            user.role,
            actorUserId,
            request.ip,
            (stage, error) => {
              request.log.warn(
                {
                  err: error,
                  requestId: request.id,
                  operation: "users.reset_password",
                  failureStage: stage,
                  targetUserId: id,
                  actorUserId,
                  runtimeDependencies: getRuntimeDependencySnapshot(),
                },
                "Password reset completed but an auxiliary step failed",
              );
            },
          );
          if (!ok)
            return { status: 404 as const, body: { type: "not_found", message: "User not found" } };
          markRequestDiagnosticStage(request, "response_serialization");
          return { status: 200 as const, body: { success: true as const } };
        } catch (error: unknown) {
          return handleUserRouterError(error, request, "Failed to reset user password", {
            operation: "users.reset_password",
            targetUserId: id,
            actorUserId,
          });
        }
      },
    },
  } as unknown as RouterImplementation<typeof userContract>);

  await fastify.register(s.plugin(router), {
    requestValidationErrorHandler: standardRequestValidationErrorHandler,
  });
};
