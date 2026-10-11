import type { FastifyInstance } from "fastify";
import type { ZodType } from "zod";

import type { User } from "@mms/shared";
import { canDeleteCollection, canWriteCollection } from "./rbacCanHelpers.js";
import {
  sendForbidden,
  sendDatabaseError,
  sendIfHttpDomainError,
  sendConflict,
} from "./httpErrors.js";
import { isUniqueViolation } from "./pgErrors.js";
import { parseRequest, replyValidationError } from "./zodRequest.js";
import { bulkIdsBodySchema } from "@mms/shared";
import {
  handleBulkListGet,
  shouldCaptureDeletionReason,
  type BulkRoutesOptions,
  type SoftDeletableBulkRoutesOptions,
  type SoftDeletableBulkTrashRoutesOptions,
} from "./crudBulkRouteHelpers.js";
import { registerSingleDeleteRoute, registerSingleRestoreRoute } from "./crudResourceRoutes.js";

/**
 * Registers GET and PUT endpoints for a bulk list collection.
 */
export function registerBulkRoutes<T>(
  fastify: FastifyInstance,
  options: BulkRoutesOptions<T>,
): void {
  const {
    path,
    collection,
    schema,
    loadFn,
    loadPageFn,
    listQuerySchema,
    defaultPageSize,
    saveFn,
    responseKey,
    errorMessagePrefix,
    customGetRoute,
  } = options;

  if (!customGetRoute && loadFn) {
    fastify.get(path, async (request, reply) => {
      return handleBulkListGet(request, reply, request.user as User, collection, {
        loadFn,
        loadPageFn,
        listQuerySchema,
        defaultPageSize,
        responseKey,
        errorMessagePrefix,
      });
    });
  }

  fastify.put(path === "/" ? "/bulk" : `${path}/bulk`, async (request, reply) => {
    const user = request.user as User;
    if (!canWriteCollection(user, collection)) return sendForbidden(reply);
    const parsed = parseRequest(schema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    try {
      const updated = await saveFn(parsed.data);
      return reply.send({ [responseKey]: updated });
    } catch (error: unknown) {
      const mapped = sendIfHttpDomainError(reply, error);
      if (mapped) return mapped;
      return sendDatabaseError(reply, `Failed to update ${errorMessagePrefix}`, error);
    }
  });
}

/**
 * Registers GET(+trash)/PUT bulk for collections that support `includeDeleted`
 * without exposing soft-delete/restore endpoints.
 */
export function registerIncludableBulkRoutes<T>(
  fastify: FastifyInstance,
  options: {
    path: string;
    collection: string;
    schema: ZodType<T>;
    loadFn?: (options?: { includeDeleted?: boolean }) => Promise<unknown>;
    loadPageFn?: (query: Record<string, unknown>) => Promise<unknown>;
    /** When provided, the GET branch validates the full query (page/limit/search/sort/filters) and forwards it to `loadPageFn`. */
    listQuerySchema?: ZodType;
    /** Fallback page size when the client omits `limit` (schema path). */
    defaultPageSize?: number;
    saveFn: (data: T) => Promise<unknown>;
    responseKey: string;
    errorMessagePrefix: string;
    customGetRoute?: boolean;
    canDelete?: (user: User) => boolean;
  },
): void {
  const {
    path,
    collection,
    schema,
    loadFn,
    loadPageFn,
    listQuerySchema,
    defaultPageSize,
    saveFn,
    responseKey,
    errorMessagePrefix,
    customGetRoute,
    canDelete,
  } = options;

  const bulkPath = path === "/" ? "/bulk" : `${path}/bulk`;

  if (!customGetRoute && loadFn) {
    fastify.get(path, async (request, reply) => {
      return handleBulkListGet(request, reply, request.user as User, collection, {
        loadFn,
        loadPageFn,
        listQuerySchema,
        defaultPageSize,
        responseKey,
        errorMessagePrefix,
        supportsIncludeDeleted: true,
        canDelete,
      });
    });
  }

  fastify.put(bulkPath, async (request, reply) => {
    const user = request.user as User;
    if (!canWriteCollection(user, collection)) return sendForbidden(reply);
    const parsed = parseRequest(schema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    try {
      const updated = await saveFn(parsed.data);
      return reply.send({ [responseKey]: updated });
    } catch (error: unknown) {
      const mapped = sendIfHttpDomainError(reply, error);
      if (mapped) return mapped;
      return sendDatabaseError(reply, `Failed to update ${errorMessagePrefix}`, error);
    }
  });
}

/**
 * Registers only POST `/bulk-delete` + `/bulk-restore` (Contacts/Students + soft-deletable modules).
 * Use when single delete/restore are registered elsewhere (standard tenant routes / custom handlers).
 */
export function registerSoftDeletableBulkTrashRoutes(
  fastify: FastifyInstance,
  options: SoftDeletableBulkTrashRoutesOptions,
): void {
  const path = options.path ?? "/";
  const bulkDeletePath = path === "/" ? "/bulk-delete" : `${path}/bulk-delete`;
  const bulkRestorePath = path === "/" ? "/bulk-restore" : `${path}/bulk-restore`;
  const bulkBodySchema = options.bulkBodySchema ?? bulkIdsBodySchema;
  const canDelete =
    options.canDelete ?? ((user: User) => canDeleteCollection(user, options.collection));

  fastify.post(bulkDeletePath, async (request, reply) => {
    const user = request.user as User;
    if (!canDelete(user)) return sendForbidden(reply);
    const parsed = parseRequest(bulkBodySchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    try {
      const ids = parsed.data.ids.map(String);
      const captureReason = shouldCaptureDeletionReason(
        options.collection,
        options.captureDeletionReason,
      );
      const reason = captureReason ? parsed.data.deletionReason : undefined;
      const result = await options.bulkDeleteFn(ids, String(user.id), reason);
      await options.onAfterBulkDelete?.(user, result, reason);
      return reply.send({ success: true, ...result });
    } catch (error: unknown) {
      const mapped = options.mapDeleteError?.(error);
      if (mapped) return reply.status(mapped.statusCode).send(mapped.body);
      const domainHandled = sendIfHttpDomainError(reply, error);
      if (domainHandled) return domainHandled;
      return sendDatabaseError(reply, `Failed to bulk delete ${options.errorMessagePrefix}`, error);
    }
  });

  fastify.post(bulkRestorePath, async (request, reply) => {
    const user = request.user as User;
    if (!canDelete(user)) return sendForbidden(reply);
    const parsed = parseRequest(bulkBodySchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    try {
      const ids = parsed.data.ids.map(String);
      const result = await options.bulkRestoreFn(ids, String(user.id));
      await options.onAfterBulkRestore?.(user, result);
      return reply.send({ success: true, ...result });
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        return sendConflict(reply, "A record with this unique identifier already exists");
      }
      const mapped = options.mapRestoreError?.(error);
      if (mapped) return reply.status(mapped.statusCode).send(mapped.body);
      const domainHandled = sendIfHttpDomainError(reply, error);
      if (domainHandled) return domainHandled;
      return sendDatabaseError(
        reply,
        `Failed to bulk restore ${options.errorMessagePrefix}`,
        error,
      );
    }
  });
}

/**
 * Registers GET(+trash)/PUT bulk/soft-delete/restore for a soft-deletable collection.
 */
export function registerSoftDeletableBulkRoutes<T>(
  fastify: FastifyInstance,
  options: SoftDeletableBulkRoutesOptions<T> & {
    customGetRoute?: boolean;
    customBulkTrashRoutes?: boolean;
  },
): void {
  const {
    path = "/",
    collection,
    schema,
    loadFn,
    saveFn,
    deleteFn,
    restoreFn,
    bulkDeleteFn,
    bulkRestoreFn,
    responseKey,
    errorMessagePrefix,
    nameSingular,
    bulkBodySchema = bulkIdsBodySchema,
    mapDeleteError,
    mapRestoreError,
    customGetRoute,
    customBulkTrashRoutes,
    captureDeletionReason,
  } = options;

  const canDelete = options.canDelete ?? ((user: User) => canDeleteCollection(user, collection));

  registerIncludableBulkRoutes(fastify, {
    path,
    collection,
    schema,
    loadFn,
    loadPageFn: options.loadPageFn,
    listQuerySchema: options.listQuerySchema,
    defaultPageSize: options.defaultPageSize,
    saveFn,
    responseKey,
    errorMessagePrefix,
    customGetRoute,
    canDelete,
  });

  // Static bulk paths before /:id to avoid parametric capture.
  if (!customBulkTrashRoutes) {
    registerSoftDeletableBulkTrashRoutes(fastify, {
      path,
      collection,
      errorMessagePrefix,
      bulkBodySchema,
      bulkDeleteFn,
      bulkRestoreFn,
      canDelete,
      captureDeletionReason,
      mapDeleteError,
      mapRestoreError,
      onAfterBulkDelete: options.onAfterBulkDelete,
      onAfterBulkRestore: options.onAfterBulkRestore,
    });
  }

  const prefix = path === "/" ? "" : path;

  // Cast to optional: options type requires them but the factory supports partial
  // registration (e.g. Contacts registers single routes via registerResourceRoutes).
  const optDeleteFn: typeof deleteFn | undefined = deleteFn;
  const optRestoreFn: typeof restoreFn | undefined = restoreFn;

  if (optDeleteFn) {
    registerSingleDeleteRoute(fastify, {
      prefix,
      collection,
      nameSingular,
      deleteFn: optDeleteFn,
      canDelete,
      captureDeletionReason,
      onAfterDelete: options.onAfterDelete,
      mapDeleteError,
    });
  }

  if (optRestoreFn) {
    registerSingleRestoreRoute(fastify, {
      prefix,
      collection,
      nameSingular,
      restoreFn: optRestoreFn,
      canDelete,
      onAfterRestore: options.onAfterRestore,
      mapRestoreError,
    });
  }
}
