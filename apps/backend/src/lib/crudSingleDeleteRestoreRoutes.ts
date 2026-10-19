import { type FastifyInstance } from "fastify";
import {
  type User,
  resourceIdParamsSchema,
  softDeleteBodySchema,
} from "@mms/shared";
import { canDeleteCollection } from "./rbacCanHelpers.js";
import {
  sendForbidden,
  sendDatabaseError,
  sendNotFound,
  sendConflict,
  sendIfHttpDomainError,
} from "./httpErrors.js";
import { isUniqueViolation } from "./pgErrors.js";
import { parseRequest, replyValidationError } from "./zodRequest.js";
import { shouldCaptureDeletionReason } from "./crudBulkRouteHelpers.js";
import type { SoftDeleteRouteErrorMapper } from "./crudBulkRoutes.js";

export interface SingleDeleteRouteOptions {
  prefix?: string;
  collection: string;
  nameSingular: string;
  deleteFn: (id: string, userId: string, reason?: string) => Promise<unknown | null>;
  canDelete?: (user: User) => boolean;
  captureDeletionReason?: boolean;
  onAfterDelete?: (user: User, id: string, reason?: string) => Promise<void>;
  mapDeleteError?: SoftDeleteRouteErrorMapper;
}

export interface SingleRestoreRouteOptions {
  prefix?: string;
  collection: string;
  nameSingular: string;
  restoreFn: (id: string, userId: string) => Promise<unknown | null>;
  canDelete?: (user: User) => boolean;
  onAfterRestore?: (user: User, id: string) => Promise<void>;
  buildRestoreResponse?: (
    restored: unknown,
    user: User,
  ) => Promise<Record<string, unknown>> | Record<string, unknown>;
  mapRestoreError?: SoftDeleteRouteErrorMapper;
}

/**
 * Registers a standard single DELETE /:id endpoint with soft-delete body parsing,
 * RBAC enforcement, manifest deletionReason stripping, and error mapping.
 */
export function registerSingleDeleteRoute(
  fastify: FastifyInstance,
  options: SingleDeleteRouteOptions,
): void {
  const {
    prefix = "",
    collection,
    nameSingular,
    deleteFn,
    canDelete = (user) => canDeleteCollection(user, collection),
    captureDeletionReason,
    onAfterDelete,
    mapDeleteError,
  } = options;

  fastify.delete<{ Params: { id: string } }>(`${prefix}/:id`, async (request, reply) => {
    const user = request.user as User;
    if (!canDelete(user)) return sendForbidden(reply);
    const params = parseRequest(resourceIdParamsSchema, request.params);
    if (!params.ok) return replyValidationError(reply, params.message);
    const body = parseRequest(softDeleteBodySchema, request.body ?? {});
    if (!body.ok) return replyValidationError(reply, body.message);
    try {
      const captureReason = shouldCaptureDeletionReason(collection, captureDeletionReason);
      const reason = captureReason ? body.data.deletionReason : undefined;
      const deleted =
        reason !== undefined
          ? await deleteFn(params.data.id, String(user.id), reason)
          : await deleteFn(params.data.id, String(user.id));
      if (!deleted) {
        return sendNotFound(
          reply,
          `${nameSingular.charAt(0).toUpperCase() + nameSingular.slice(1)} not found`,
        );
      }
      await onAfterDelete?.(user, params.data.id, reason);
      return reply.send({ success: true });
    } catch (error: unknown) {
      const mapped = mapDeleteError?.(error);
      if (mapped) return reply.status(mapped.statusCode).send(mapped.body);
      const domainHandled = sendIfHttpDomainError(reply, error);
      if (domainHandled) return domainHandled;
      return sendDatabaseError(reply, `Failed to delete ${nameSingular}`, error);
    }
  });
}

/**
 * Registers a standard single POST /:id/restore endpoint with RBAC enforcement,
 * userId attribution, conflict mapping, and custom restore responses.
 */
export function registerSingleRestoreRoute(
  fastify: FastifyInstance,
  options: SingleRestoreRouteOptions,
): void {
  const {
    prefix = "",
    collection,
    nameSingular,
    restoreFn,
    canDelete = (user) => canDeleteCollection(user, collection),
    onAfterRestore,
    buildRestoreResponse,
    mapRestoreError,
  } = options;

  fastify.post(`${prefix}/:id/restore`, async (request, reply) => {
    const user = request.user as User;
    if (!canDelete(user)) return sendForbidden(reply);
    const params = parseRequest(resourceIdParamsSchema, request.params);
    if (!params.ok) return replyValidationError(reply, params.message);
    try {
      const restored = await restoreFn(params.data.id, String(user.id));
      if (!restored) {
        return sendNotFound(
          reply,
          `${nameSingular.charAt(0).toUpperCase() + nameSingular.slice(1)} not found or not deleted`,
        );
      }
      await onAfterRestore?.(user, params.data.id);
      const payload = buildRestoreResponse
        ? await buildRestoreResponse(restored, user)
        : { success: true };
      return reply.send(payload);
    } catch (error: unknown) {
      const mapped = mapRestoreError?.(error);
      if (mapped) return reply.status(mapped.statusCode).send(mapped.body);
      const domainHandled = sendIfHttpDomainError(reply, error);
      if (domainHandled) return domainHandled;
      if (isUniqueViolation(error)) {
        return sendConflict(reply, "A record with this unique identifier already exists");
      }
      return sendDatabaseError(reply, `Failed to restore ${nameSingular}`, error);
    }
  });
}
