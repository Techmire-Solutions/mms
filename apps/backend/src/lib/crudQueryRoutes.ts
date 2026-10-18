import { type FastifyInstance, type FastifyRequest } from "fastify";
import { z } from "zod";
import type { ZodType } from "zod";

import type { User } from "@mms/shared";
import {
  countResponseSchema,
  entityResolveBodySchema,
  widgetAggregatesBodySchema,
  type widgetQuerySchema,
  linkedContactIdsQuerySchema,
} from "@mms/shared";
import { canReadCollection, canWriteCollection } from "./rbacCanHelpers.js";
import { sendForbidden, sendDatabaseError } from "./httpErrors.js";
import { parseRequest, replyValidationError } from "./zodRequest.js";
import { getRequestTenant } from "./tenantContext.js";
import { redisGet, redisSet, redisKeys } from "./redis.js";

type WidgetQuery = z.infer<typeof widgetQuerySchema>;

const METRICS_CACHE_TTL_SECONDS = 60;

export interface MetricsRouteOptions {
  path?: string; // defaults to '/metrics'
  collection: string;
  loadMetricsFn: (request: FastifyRequest) => Promise<unknown>;
  errorMessagePrefix: string;
}

/**
 * Registers a standard metrics endpoint with RBAC checks, Redis caching, and error handling.
 */
export function registerMetricsRoute(fastify: FastifyInstance, options: MetricsRouteOptions): void {
  const { path = "/metrics", collection, loadMetricsFn, errorMessagePrefix } = options;

  fastify.get(path, async (request, reply) => {
    const user = request.user as User;
    if (!canReadCollection(user, collection)) return sendForbidden(reply);

    const tenant = getRequestTenant()?.trim().toLowerCase();
    // Role is part of the key: metrics are RBAC-filtered per caller, so a
    // shared tenant+collection key could serve one role's numbers to another.
    const cacheKey = tenant
      ? redisKeys.metrics(tenant, `${collection}:${user.role ?? "user"}`)
      : null;
    if (cacheKey) {
      const cached = await redisGet(cacheKey);
      if (cached) {
        try {
          return reply.send({ metrics: JSON.parse(cached) });
        } catch {
          // Recompute on JSON parse failure
        }
      }
    }

    try {
      const metrics = await loadMetricsFn(request);
      if (cacheKey && metrics) {
        await redisSet(cacheKey, JSON.stringify(metrics), METRICS_CACHE_TTL_SECONDS);
      }
      return reply.send({ metrics });
    } catch {
      return sendDatabaseError(reply, `Failed to load ${errorMessagePrefix} metrics`);
    }
  });
}

export interface CountRouteOptions {
  path?: string;
  collection: string;
  /** Prefer SQL/count helpers — avoids loading every row. */
  loadCountFn: () => Promise<number>;
  errorMessagePrefix: string;
}

/**
 * Registers a standard count endpoint with RBAC checks.
 */
export function registerCountRoute(fastify: FastifyInstance, options: CountRouteOptions): void {
  const { path = "/count", collection, loadCountFn, errorMessagePrefix } = options;

  fastify.get(
    path,
    {
      schema: {
        response: {
          200: countResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const user = request.user as User;
      if (!canReadCollection(user, collection)) return sendForbidden(reply);
      try {
        const count = await loadCountFn();
        return reply.send({ count });
      } catch {
        return sendDatabaseError(reply, `Failed to count ${errorMessagePrefix}`);
      }
    },
  );
}

export interface ResolveRouteOptions {
  path?: string;
  collection: string;
  loadByIdsFn: (ids: string[], request: FastifyRequest) => Promise<unknown[]>;
  responseKey: string;
  aliases?: string[];
  errorMessagePrefix: string;
}

/**
 * Registers a standard resolve endpoint with RBAC checks.
 */
export function registerResolveRoute(fastify: FastifyInstance, options: ResolveRouteOptions): void {
  const {
    path = "/resolve",
    collection,
    loadByIdsFn,
    responseKey,
    aliases,
    errorMessagePrefix,
  } = options;

  fastify.post(path, async (request, reply) => {
    const user = request.user as User;
    if (!canReadCollection(user, collection)) return sendForbidden(reply);
    const parsed = parseRequest(entityResolveBodySchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    try {
      const items = await loadByIdsFn(parsed.data.ids, request);
      const responsePayload: Record<string, unknown> = { [responseKey]: items };
      if (aliases) {
        for (const alias of aliases) {
          responsePayload[alias] = items;
        }
      }
      return reply.send(responsePayload);
    } catch {
      return sendDatabaseError(reply, `Failed to resolve ${errorMessagePrefix}`);
    }
  });
}

export interface WidgetAggregatesRouteOptions {
  path?: string;
  collection: string;
  loadAggregatesFn: (widgets: WidgetQuery[], request: FastifyRequest) => Promise<unknown>;
  errorMessagePrefix: string;
}

/**
 * Registers a standard widget aggregates endpoint with RBAC checks.
 */
export function registerWidgetAggregatesRoute(
  fastify: FastifyInstance,
  options: WidgetAggregatesRouteOptions,
): void {
  const { path = "/widget-aggregates", collection, loadAggregatesFn, errorMessagePrefix } = options;

  fastify.post(path, async (request, reply) => {
    const user = request.user as User;
    if (!canReadCollection(user, collection)) return sendForbidden(reply);
    const parsed = parseRequest(widgetAggregatesBodySchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    try {
      const results = await loadAggregatesFn(parsed.data.widgets, request);
      return reply.send({ results });
    } catch (err) {
      request.log.error(err, `Failed to load ${errorMessagePrefix} widget aggregates`);
      return sendDatabaseError(reply, `Failed to load ${errorMessagePrefix} widget aggregates`);
    }
  });
}

export interface LinkedContactIdsRouteOptions {
  path?: string;
  collection: string;
  loadLinkedContactIdsFn: (excludeId?: string) => Promise<(string | number)[]>;
  errorMessagePrefix: string;
}

/**
 * Registers a standard linked contact IDs endpoint with RBAC checks.
 */
export function registerLinkedContactIdsRoute(
  fastify: FastifyInstance,
  options: LinkedContactIdsRouteOptions,
): void {
  const {
    path = "/linked-contact-ids",
    collection,
    loadLinkedContactIdsFn,
    errorMessagePrefix,
  } = options;

  fastify.get(path, async (request, reply) => {
    const user = request.user as User;
    if (!canReadCollection(user, collection)) return sendForbidden(reply);
    const parsed = parseRequest(linkedContactIdsQuerySchema, request.query);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    try {
      const contactIds = await loadLinkedContactIdsFn(parsed.data.excludeId);
      return reply.send({ contactIds });
    } catch {
      return sendDatabaseError(
        reply,
        `Failed to load linked contact ids for ${errorMessagePrefix}`,
      );
    }
  });
}

export interface BulkPutRouteOptions<T> {
  path?: string;
  collection: string;
  schema: ZodType<T>;
  saveFn: (data: T) => Promise<unknown>;
  responseKey: string;
  errorMessagePrefix: string;
}

/**
 * Registers a bulk PUT endpoint with standard RBAC, validation, and error handling.
 */
export function registerBulkPutRoute<T>(
  fastify: FastifyInstance,
  options: BulkPutRouteOptions<T>,
): void {
  const { path = "/bulk", collection, schema, saveFn, responseKey, errorMessagePrefix } = options;

  fastify.put(path, async (request, reply) => {
    const user = request.user as User;
    if (!canWriteCollection(user, collection)) return sendForbidden(reply);
    const parsed = parseRequest(schema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    try {
      const updated = await saveFn(parsed.data);
      return reply.send({ [responseKey]: updated });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return replyValidationError(reply, error.issues.map((issue) => issue.message).join("; "));
      }
      request.log.error(error, `Failed to replace ${errorMessagePrefix}`);
      return sendDatabaseError(reply, `Failed to replace ${errorMessagePrefix}`);
    }
  });
}
