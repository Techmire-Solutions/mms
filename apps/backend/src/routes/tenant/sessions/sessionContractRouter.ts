import type { FastifyPluginAsync } from "fastify";
import { initServer, type RouterImplementation } from "@ts-rest/fastify";
import { handleContractError } from "../../../lib/contractError.js";
import { standardRequestValidationErrorHandler } from "../../../lib/contractRegistration.js";
import { enforceSessionResponses } from "../../../lib/sessionContractResponses.js";
import { parseOccHeaders } from "../../../lib/occHeaders.js";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { withTenant } from "../../../db/tenant-context.js";
import { sessionContract, isQueryFlagTrue, SESSIONS_MODULE_MANIFEST, type User } from "@mms/shared";
import {
  canDeleteCollection,
  canWriteCollection,
  canReadCollection,
} from "../../../services/rbacService.js";
import { sessionsUseCases } from "../../../sessions/use-cases/sessionsUseCases.js";
import { sessionBulkContractHandlers } from "./sessionBulkContractHandlers.js";
import { sessionSetupContractHandlers } from "./sessionSetupContractHandlers.js";
import { userHasPermission } from "../../../lib/userPermissionContext.js";

const COLLECTION = SESSIONS_MODULE_MANIFEST.collectionKey;
const OVERRIDE_LOCK_PERM = SESSIONS_MODULE_MANIFEST.permissions.overrideLock;
const s = initServer();

export const sessionContractRouter: FastifyPluginAsync = async (fastify) => {
  const router = s.router(
    sessionContract,
    enforceSessionResponses(sessionContract, {
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
        // The base query schema accepts the cursor flag as a string union: normalize it before the
        // repository sees it (`"false"` is truthy and would silently skip the count).
        const skipCount = isQueryFlagTrue(query?.skipCount);
        const afterId = query?.afterId?.trim() || undefined;
        if (afterId && (query?.sortField?.trim() || query?.sortDir)) {
          return {
            status: 400 as const,
            body: {
              type: "validation_error",
              message: "Cursor paging is id-ordered; remove sortField/sortDir when using afterId",
            },
          };
        }
        try {
          const result = await withTenant(
            String(request.tenant?.id),
            () =>
              sessionsUseCases.loadSessionsPage({
                ...query,
                includeDeleted,
                skipCount,
                afterId,
                view: query?.view ?? "full",
              }),
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
          const lock = { canOverrideLock: userHasPermission(user, OVERRIDE_LOCK_PERM) };
          // Malformed tokens are a 400; a missing token is left to the use-case 428 guard.
          const { expectedVersion, expectedUpdatedAt } = parseOccHeaders(request);
          const updated = await withTenant(
            String(request.tenant?.id),
            () =>
              sessionsUseCases.updateSessionById(
                id,
                body,
                lock,
                expectedUpdatedAt,
                expectedVersion,
              ),
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
            () =>
              sessionsUseCases.deleteSessionById(
                id,
                String(user.id),
                body?.deletionReason,
                // Trashing a session that has not reached a terminal state is destructive: it needs
                // the lock-override permission plus a recorded reason.
                { allowNonTerminal: userHasPermission(user, OVERRIDE_LOCK_PERM) },
              ),
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
    } as unknown as RouterImplementation<typeof sessionContract>),
  );

  await fastify.register(s.plugin(router), {
    requestValidationErrorHandler: standardRequestValidationErrorHandler,
    responseValidation: true,
  });
};
