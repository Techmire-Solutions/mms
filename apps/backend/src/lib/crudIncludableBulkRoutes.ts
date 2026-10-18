import type { FastifyInstance } from "fastify";
import type { ZodType } from "zod";

import type { User } from "@mms/shared";
import { canWriteCollection } from "./rbacCanHelpers.js";
import { sendForbidden, sendDatabaseError, sendIfHttpDomainError } from "./httpErrors.js";
import { parseRequest, replyValidationError } from "./zodRequest.js";
import { handleBulkListGet } from "./crudBulkRouteHelpers.js";

export interface IncludableBulkRoutesOptions<T> {
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
}

/**
 * Registers GET(+trash)/PUT bulk for collections that support `includeDeleted`
 * without exposing soft-delete/restore endpoints.
 */
export function registerIncludableBulkRoutes<T>(
  fastify: FastifyInstance,
  options: IncludableBulkRoutesOptions<T>,
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
