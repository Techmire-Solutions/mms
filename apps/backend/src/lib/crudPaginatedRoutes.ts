import type { FastifyInstance } from "fastify";
import type { ZodType } from "zod";

import { isQueryFlagTrue, type User } from "@mms/shared";
import { canReadCollection, canWriteCollection } from "./rbacCanHelpers.js";
import { sendForbidden, sendDatabaseError } from "./httpErrors.js";
import { parseRequest, replyValidationError } from "./zodRequest.js";

export interface PaginatedListRouteOptions<TQuery, TPageResult> {
  path?: string;
  collection: string;
  schema: ZodType<TQuery>;
  loadPageFn: (query: TQuery & { includeDeleted: boolean }) => Promise<TPageResult>;
  defaultPageSize: number;
  errorMessagePrefix: string;
  canWriteDeletedCheck?: (user: User) => boolean;
  responseTransform?: (result: TPageResult, user: User) => Promise<unknown> | unknown;
}

export function registerPaginatedListRoute<
  TQuery extends { page?: number; limit?: number; includeDeleted?: string | boolean },
  TPageResult,
>(fastify: FastifyInstance, options: PaginatedListRouteOptions<TQuery, TPageResult>): void {
  const {
    path,
    collection,
    schema,
    loadPageFn,
    defaultPageSize,
    errorMessagePrefix,
    canWriteDeletedCheck,
    responseTransform,
  } = options;

  fastify.get(path || "/", async (request, reply) => {
    const user = request.user as User;
    if (!canReadCollection(user, collection)) {
      return sendForbidden(reply);
    }
    const queryParsed = parseRequest(schema, request.query);
    if (!queryParsed.ok) {
      return replyValidationError(reply, queryParsed.message);
    }
    try {
      const query = queryParsed.data;
      const includeDeleted = isQueryFlagTrue(query.includeDeleted);
      if (includeDeleted) {
        const allowed = canWriteDeletedCheck
          ? canWriteDeletedCheck(user)
          : canWriteCollection(user, collection);
        if (!allowed) return sendForbidden(reply);
      }

      const page = await loadPageFn({
        ...query,
        page: query.page ?? 1,
        limit: query.limit ?? defaultPageSize,
        includeDeleted,
      });
      const responseData = responseTransform ? await responseTransform(page, user) : page;
      return reply.send(responseData);
    } catch (error: unknown) {
      return sendDatabaseError(reply, `Failed to list ${errorMessagePrefix}`, error);
    }
  });
}
