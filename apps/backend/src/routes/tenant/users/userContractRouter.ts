import type { FastifyPluginAsync } from "fastify";
import type { User } from "@mms/shared";
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
  buildUserResetPasswordRoute,
  handleUserBulkDelete,
  handleUserBulkRestore,
  handleUserBulkUpdate,
  handleUserRouterError,
} from "./userContractHandlers.js";

const s = initServer();

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
    bulkUpdate: handleUserBulkUpdate,
    bulkDelete: handleUserBulkDelete,
    bulkRestore: handleUserBulkRestore,
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
    resetPassword: buildUserResetPasswordRoute(resetPasswordRateLimit),
  } as unknown as RouterImplementation<typeof userContract>);

  await fastify.register(s.plugin(router), {
    requestValidationErrorHandler: standardRequestValidationErrorHandler,
  });
};
