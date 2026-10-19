import { type FastifyInstance } from "fastify";
import { z, type ZodType } from "zod";

import { isQueryFlagTrue, type User, resourceIdParamsSchema } from "@mms/shared";
import { canDeleteCollection, canReadCollection, canWriteCollection } from "./rbacCanHelpers.js";
import {
  sendForbidden,
  sendDatabaseError,
  sendNotFound,
  sendConflict,
  sendIfHttpDomainError,
} from "./httpErrors.js";
import { isUniqueViolation } from "./pgErrors.js";
import { parseRequest, replyValidationError, executeDynamicValidation } from "./zodRequest.js";
import { sql } from "drizzle-orm";
import { withTenant } from "../db/tenant-context.js";
import { getRequestTenant } from "./tenantContext.js";
import type { ResourceRecord } from "./crudRouterTypes.js";
import type { SoftDeleteRouteErrorMapper } from "./crudBulkRoutes.js";
import {
  type SingleDeleteRouteOptions,
  type SingleRestoreRouteOptions,
  registerSingleDeleteRoute,
  registerSingleRestoreRoute,
} from "./crudSingleDeleteRestoreRoutes.js";

export interface ResourceRoutesOptions<T extends ResourceRecord = ResourceRecord> {
  prefix?: string;
  collection: string;
  schema?: ZodType<T>;
  /** Tenant-aware strict write schema (system keys ∪ Setup custom keys). POST/PUT use it when set. */
  buildWriteSchema?: () => Promise<ZodType<T>>;
  loadByIdFn?: (id: string, includeDeleted?: boolean) => Promise<unknown | null>;
  createFn?: (data: T) => Promise<unknown>;
  updateFn?: (id: string, data: T) => Promise<unknown | null>;
  deleteFn?: (id: string, userId: string, reason?: string) => Promise<unknown | null>;
  /** Soft-restore; `userId` is the acting user (Contacts uniqueness/audit actors). */
  restoreFn?: (id: string, userId: string) => Promise<unknown | null>;
  nameSingular: string;
  namePlural: string;
  /** Deprecated: unpaged GET routes have been eliminated; all lists are paginated. */
  customGetRoute?: boolean;
  customGetSingleRoute?: boolean;
  customPostRoute?: boolean;
  customPutRoute?: boolean;
  validateDynamicFn?: (tenant: string, data: T, lang: string, user: User) => Promise<void>;
  /** Override collection delete capability (defaults to canDeleteCollection). */
  canDelete?: (user: User) => boolean;
  /** Whether this module captures deletion reason. Defaults to true. When false, deletionReason is stripped. */
  captureDeletionReason?: boolean;
  /** Optional post-create audit hook. */
  onAfterCreate?: (user: User, item: unknown) => Promise<void>;
  /** Optional post-update audit hook. */
  onAfterUpdate?: (user: User, id: string, updated: unknown) => Promise<void>;
  /** Optional post-soft-delete audit hook (Students SSOT with Contacts). */
  onAfterDelete?: (user: User, id: string, deletionReason?: string) => Promise<void>;
  /** Optional post-restore audit hook. */
  onAfterRestore?: (user: User, id: string) => Promise<void>;
  /** Replace default `{ success: true }` restore payload (Contacts returns sanitized entity). */
  buildRestoreResponse?: (
    restored: unknown,
    user: User,
  ) => Promise<Record<string, unknown>> | Record<string, unknown>;
  /** Transform single-entity responses (GET /:id, POST, PUT) — used for viewer-role sanitization. */
  buildSingleResponse?: (item: unknown, user: User) => Promise<unknown> | unknown;
  /** Map domain delete failures (e.g. active dependencies, restrict guards) to stable HTTP responses. */
  mapDeleteError?: SoftDeleteRouteErrorMapper;
  /** Map domain restore failures (e.g. unique field conflicts) to HTTP replies. */
  mapRestoreError?: SoftDeleteRouteErrorMapper;
}

/**
 * Registers standard REST resource CRUD endpoints (GET, POST, PUT, DELETE, restore).
 */
export function registerResourceRoutes<T extends ResourceRecord>(
  fastify: FastifyInstance,
  options: ResourceRoutesOptions<T>,
): void {
  const {
    prefix = "",
    collection,
    schema,
    buildWriteSchema,
    loadByIdFn,
    createFn,
    updateFn,
    deleteFn,
    restoreFn,
    nameSingular,
    namePlural,
    customGetSingleRoute = false,
    customPostRoute = false,
    customPutRoute = false,
    validateDynamicFn,
    canDelete = (user) => canDeleteCollection(user, collection),
    captureDeletionReason,
    onAfterCreate,
    onAfterUpdate,
    onAfterDelete,
    onAfterRestore,
    buildRestoreResponse,
    buildSingleResponse,
    mapDeleteError,
    mapRestoreError,
  } = options;

  // GET /:id or GET /prefix/:id
  if (!customGetSingleRoute && loadByIdFn) {
    fastify.get(`${prefix}/:id`, async (request, reply) => {
      const user = request.user as User;
      if (!canReadCollection(user, collection)) return sendForbidden(reply);
      const params = parseRequest(resourceIdParamsSchema, request.params);
      if (!params.ok) return replyValidationError(reply, params.message);
      const query = request.query as { includeDeleted?: unknown } | undefined;
      const includeDeleted = isQueryFlagTrue(query?.includeDeleted);
      if (includeDeleted && !canDelete(user)) {
        return sendForbidden(reply, `Viewing deleted ${namePlural} requires delete permissions`);
      }
      try {
        const tenant = getRequestTenant() ?? user.workspaceSubdomain;
        const item = includeDeleted
          ? await withTenant(tenant, async (tx) => {
              if (tx && typeof tx.execute === "function") {
                await tx.execute(sql`SET LOCAL app.include_deleted = 'true'`);
              }
              return loadByIdFn(params.data.id, true);
            })
          : await loadByIdFn(params.data.id, false);

        if (!item || (!includeDeleted && (item as { deletedAt?: unknown }).deletedAt != null)) {
          return sendNotFound(
            reply,
            `${nameSingular.charAt(0).toUpperCase() + nameSingular.slice(1)} not found`,
          );
        }
        const response = buildSingleResponse ? await buildSingleResponse(item, user) : item;
        return reply.send({ [nameSingular]: response });
      } catch (error: unknown) {
        const domainHandled = sendIfHttpDomainError(reply, error);
        if (domainHandled) return domainHandled;
        return sendDatabaseError(reply, `Failed to load ${nameSingular}`, error);
      }
    });
  }

  // POST / or POST /prefix
  if (!customPostRoute && createFn) {
    const routeOptions = validateDynamicFn
      ? {
          bodyLimit: 1048576,
          schema: { body: z.record(z.string(), z.unknown()) },
        }
      : {};

    fastify.post(prefix || "/", routeOptions, async (request, reply) => {
      const user = request.user as User;
      if (!canWriteCollection(user, collection)) return sendForbidden(reply);
      const writeSchema = buildWriteSchema ? await buildWriteSchema() : schema;
      if (!writeSchema)
        return sendDatabaseError(
          reply,
          `Schema required to create ${nameSingular}`,
          new Error("Missing schema"),
        );
      const parsed = parseRequest(writeSchema, request.body);
      if (!parsed.ok) return replyValidationError(reply, parsed.message);

      if (validateDynamicFn) {
        const isValid = await executeDynamicValidation(request, reply, (tenant, lang) =>
          validateDynamicFn(tenant, parsed.data, lang, user),
        );
        if (!isValid) return;
      }

      try {
        const item = await createFn(parsed.data);
        await onAfterCreate?.(user, item);
        const response = buildSingleResponse ? await buildSingleResponse(item, user) : item;
        return reply.status(201).send({ [nameSingular]: response });
      } catch (error: unknown) {
        const domainHandled = sendIfHttpDomainError(reply, error);
        if (domainHandled) return domainHandled;
        if (isUniqueViolation(error)) {
          return sendConflict(reply, `A record with this unique identifier already exists`);
        }
        return sendDatabaseError(reply, `Failed to create ${nameSingular}`, error);
      }
    });
  }

  // PUT /:id or PUT /prefix/:id
  if (!customPutRoute && updateFn) {
    const routeOptions = validateDynamicFn
      ? {
          bodyLimit: 1048576,
          schema: { body: z.record(z.string(), z.unknown()), params: resourceIdParamsSchema },
        }
      : {};

    fastify.put(`${prefix}/:id`, routeOptions, async (request, reply) => {
      const user = request.user as User;
      if (!canWriteCollection(user, collection)) return sendForbidden(reply);
      const params = parseRequest(resourceIdParamsSchema, request.params);
      const writeSchema = buildWriteSchema ? await buildWriteSchema() : schema;
      if (!writeSchema)
        return sendDatabaseError(
          reply,
          `Schema required to update ${nameSingular}`,
          new Error("Missing schema"),
        );
      const body = parseRequest(writeSchema, request.body);
      if (!params.ok) return replyValidationError(reply, params.message);
      if (!body.ok) return replyValidationError(reply, body.message);

      if (validateDynamicFn) {
        const isValid = await executeDynamicValidation(request, reply, (tenant, lang) =>
          validateDynamicFn(tenant, body.data, lang, user),
        );
        if (!isValid) return;
      }

      // The URL id is authoritative. Without this guard, `PUT /things/A` with a
      // body id of `B` would update B — a cross-record write.
      const bodyId = (body.data as { id?: unknown }).id;
      if (bodyId !== undefined && bodyId !== null && String(bodyId) !== params.data.id) {
        return replyValidationError(reply, "Body id does not match the URL id");
      }

      try {
        const updated = await updateFn(params.data.id, {
          ...body.data,
          id: params.data.id,
        });
        if (!updated) {
          return sendNotFound(
            reply,
            `${nameSingular.charAt(0).toUpperCase() + nameSingular.slice(1)} not found`,
          );
        }
        await onAfterUpdate?.(user, params.data.id, updated);
        const response = buildSingleResponse ? await buildSingleResponse(updated, user) : updated;
        return reply.send({ [nameSingular]: response });
      } catch (error: unknown) {
        const domainHandled = sendIfHttpDomainError(reply, error);
        if (domainHandled) return domainHandled;
        if (isUniqueViolation(error)) {
          return sendConflict(reply, `A record with this unique identifier already exists`);
        }
        return sendDatabaseError(reply, `Failed to update ${nameSingular}`, error);
      }
    });
  }

  // DELETE /:id or DELETE /prefix/:id
  if (deleteFn) {
    registerSingleDeleteRoute(fastify, {
      prefix,
      collection,
      nameSingular,
      deleteFn,
      canDelete,
      captureDeletionReason,
      onAfterDelete,
      mapDeleteError,
    });
  }

  // POST /:id/restore or POST /prefix/:id/restore
  if (restoreFn) {
    registerSingleRestoreRoute(fastify, {
      prefix,
      collection,
      nameSingular,
      restoreFn,
      canDelete,
      onAfterRestore,
      buildRestoreResponse,
      mapRestoreError,
    });
  }
}

export {
  type SingleDeleteRouteOptions,
  type SingleRestoreRouteOptions,
  registerSingleDeleteRoute,
  registerSingleRestoreRoute,
};
