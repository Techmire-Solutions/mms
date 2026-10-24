import type { FastifyPluginAsync } from "fastify";
import { initServer, type RouterImplementation } from "@ts-rest/fastify";
import { handleContractError } from "../../../lib/contractError.js";
import { standardRequestValidationErrorHandler } from "../../../lib/contractRegistration.js";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { withTenant } from "../../../db/tenant-context.js";
import {
  sessionContract,
  isQueryFlagTrue,
  SESSIONS_MODULE_MANIFEST,
  type User,
  roleHasPermission,
} from "@mms/shared";
import {
  canDeleteCollection,
  canWriteCollection,
  canReadCollection,
} from "../../../services/rbacService.js";
import { sessionsUseCases } from "../../../sessions/use-cases/sessionsUseCases.js";
import { sessionBulkContractHandlers } from "./sessionBulkContractHandlers.js";
import { sessionSetupContractHandlers } from "./sessionSetupContractHandlers.js";

const COLLECTION = SESSIONS_MODULE_MANIFEST.collectionKey;
const OVERRIDE_LOCK_PERM = SESSIONS_MODULE_MANIFEST.permissions.overrideLock;
const s = initServer();

export const sessionContractRouter: FastifyPluginAsync = async (fastify) => {
  const router = s.router(sessionContract, {
    ...sessionBulkContractHandlers,
    ...sessionSetupContractHandlers,
    list: async ({
      query,
      request,
    }: ContractRouteArgs<(typeof sessionContract)["list"]>): Promise<
      ContractRouteResponse<(typeof sessionContract)["list"]>
    > => {
      const user = request.user as User;
      if (!canReadCollection(user, COLLECTION))
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      const includeDeleted = isQueryFlagTrue(query?.includeDeleted);
      if (includeDeleted && !canDeleteCollection(user, COLLECTION)) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const result = await withTenant(
          String(request.tenant?.id),
          () => sessionsUseCases.loadSessionsPage({ ...query, includeDeleted }),
          { readOnly: true },
        );
        return { status: 200 as const, body: result };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "database_error", message: "Failed to list sessions" },
        });
      }
    },

    create: async ({
      body,
      request,
    }: ContractRouteArgs<(typeof sessionContract)["create"]>): Promise<
      ContractRouteResponse<(typeof sessionContract)["create"]>
    > => {
      const user = request.user as User;
      if (!canWriteCollection(user, COLLECTION))
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      try {
        const item = await withTenant(
          String(request.tenant?.id),
          () => sessionsUseCases.createSession(body),
          { readOnly: false },
        );
        return { status: 201 as const, body: { session: item } };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "database_error", message: "Failed to create session" },
        });
      }
    },

    get: async ({
      params: { id },
      query,
      request,
    }: ContractRouteArgs<(typeof sessionContract)["get"]>): Promise<
      ContractRouteResponse<(typeof sessionContract)["get"]>
    > => {
      const user = request.user as User;
      if (!canReadCollection(user, COLLECTION))
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      const includeDeleted = isQueryFlagTrue(query?.includeDeleted);
      if (includeDeleted && !canDeleteCollection(user, COLLECTION))
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      try {
        const item = await withTenant(
          String(request.tenant?.id),
          () => sessionsUseCases.loadSessionById(id, includeDeleted),
          { readOnly: true },
        );
        if (!item)
          return {
            status: 404 as const,
            body: { type: "not_found", message: "Session not found" },
          };
        return { status: 200 as const, body: { session: item } };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "database_error", message: "Failed to load session" },
        });
      }
    },

    update: async ({
      params: { id },
      body,
      request,
    }: ContractRouteArgs<(typeof sessionContract)["update"]>): Promise<
      ContractRouteResponse<(typeof sessionContract)["update"]>
    > => {
      const user = request.user as User;
      if (!canWriteCollection(user, COLLECTION))
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      try {
        // Locked changes after start need `sessions.override_lock` plus a reason (audited).
        const lock = { canOverrideLock: roleHasPermission(user.role, OVERRIDE_LOCK_PERM) };
        const updated = await withTenant(
          String(request.tenant?.id),
          () => sessionsUseCases.updateSessionById(id, body, lock),
          { readOnly: false },
        );
        if (!updated)
          return {
            status: 404 as const,
            body: { type: "not_found", message: "Session not found" },
          };
        return { status: 200 as const, body: { session: updated } };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "database_error", message: "Failed to update session" },
        });
      }
    },

    delete: async ({
      params: { id },
      body,
      request,
    }: ContractRouteArgs<(typeof sessionContract)["delete"]>): Promise<
      ContractRouteResponse<(typeof sessionContract)["delete"]>
    > => {
      const user = request.user as User;
      if (!canDeleteCollection(user, COLLECTION))
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      try {
        await withTenant(
          String(request.tenant?.id),
          () => sessionsUseCases.deleteSessionById(id, String(user.id), body?.deletionReason),
          { readOnly: false },
        );
        return { status: 200 as const, body: { success: true } };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "database_error", message: "Failed to delete session" },
        });
      }
    },

    restore: async ({
      params: { id },
      request,
    }: ContractRouteArgs<(typeof sessionContract)["restore"]>): Promise<
      ContractRouteResponse<(typeof sessionContract)["restore"]>
    > => {
      const user = request.user as User;
      if (!canDeleteCollection(user, COLLECTION))
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      try {
        await withTenant(
          String(request.tenant?.id),
          () => sessionsUseCases.restoreSessionById(id, String(user.id)),
          { readOnly: false },
        );
        return { status: 200 as const, body: { success: true } };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "database_error", message: "Failed to restore session" },
        });
      }
    },
  } as unknown as RouterImplementation<typeof sessionContract>);

  await fastify.register(s.plugin(router), {
    requestValidationErrorHandler: standardRequestValidationErrorHandler,
  });
};
