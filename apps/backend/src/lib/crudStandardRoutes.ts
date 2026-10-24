import { type FastifyInstance, type FastifyRequest } from "fastify";
import type { ZodType } from "zod";

import type { User } from "@mms/shared";
import type { SoftDeleteRouteErrorMapper } from "./crudBulkRoutes.js";
import type { ResourceRecord } from "./crudRouterTypes.js";
import {
  registerCountRoute,
  registerLinkedContactIdsRoute,
  registerMetricsRoute,
  registerResolveRoute,
  registerWidgetAggregatesRoute,
} from "./crudQueryRoutes.js";
import { registerPaginatedListRoute } from "./crudPaginatedRoutes.js";
import { registerResourceRoutes } from "./crudResourceRoutes.js";

export interface StandardExtendedRoutesOptions<TQuery, TRecord> {
  prefix?: string;
  collection: string;
  listQuerySchema?: ZodType<TQuery>;
  defaultPageSize?: number;
  errorMessagePrefix: string;
  nameSingular: string;
  loadPageFn?: (query: TQuery & { includeDeleted: boolean }) => Promise<unknown>;
  /** Prefer SQL count — avoids hydrate-all for `/count`. */
  loadCountFn?: () => Promise<number>;
  /** Prefer SQL aggregates — avoids hydrate-all for `/metrics`. */
  loadMetricsFn?: (request: FastifyRequest) => Promise<unknown>;
  loadWidgetAggregatesFn?: (queries: unknown[], request?: unknown) => Promise<unknown>;
  loadByIdsFn?: (ids: string[], request: FastifyRequest) => Promise<TRecord[]>;
  loadLinkedContactIdsFn?: (excludeId?: string) => Promise<(string | number)[]>;
  canWriteDeletedCheck?: (user: User) => boolean;
  /** Post-load transform for paginated reads (e.g. viewer-role sanitization). */
  responseTransform?: (result: unknown, user: User) => Promise<unknown> | unknown;
}

/**
 * Registers standard extended routes (Paginated List, Count, Metrics, Widget Aggregates, Resolve, Linked Contact IDs, Column Preferences).
 */
export function registerStandardExtendedRoutes<
  TQuery extends { page?: number; limit?: number; includeDeleted?: string } = Record<
    string,
    unknown
  >,
  TRecord = unknown,
>(fastify: FastifyInstance, options: StandardExtendedRoutesOptions<TQuery, TRecord>): void {
  const {
    prefix,
    collection,
    listQuerySchema,
    defaultPageSize,
    errorMessagePrefix,
    nameSingular,
    loadPageFn,
    loadCountFn,
    loadMetricsFn,
    loadWidgetAggregatesFn,
    loadByIdsFn,
    loadLinkedContactIdsFn,
    canWriteDeletedCheck,
    responseTransform,
  } = options;

  if (listQuerySchema && loadPageFn) {
    registerPaginatedListRoute(fastify, {
      path: prefix || "/",
      collection,
      schema: listQuerySchema,
      defaultPageSize: defaultPageSize ?? 20,
      errorMessagePrefix,
      canWriteDeletedCheck,
      loadPageFn,
      responseTransform,
    });
  }

  if (loadCountFn) {
    registerCountRoute(fastify, {
      path: prefix ? `${prefix}/count` : "/count",
      collection,
      loadCountFn,
      errorMessagePrefix,
    });
  }

  if (loadMetricsFn) {
    registerMetricsRoute(fastify, {
      path: prefix ? `${prefix}/metrics` : "/metrics",
      collection,
      loadMetricsFn,
      errorMessagePrefix: nameSingular,
    });
  }

  if (loadWidgetAggregatesFn) {
    registerWidgetAggregatesRoute(fastify, {
      path: prefix ? `${prefix}/widget-aggregates` : "/widget-aggregates",
      collection,
      loadAggregatesFn: loadWidgetAggregatesFn,
      errorMessagePrefix: nameSingular,
    });
  }

  if (loadByIdsFn) {
    registerResolveRoute(fastify, {
      path: prefix ? `${prefix}/resolve` : "/resolve",
      collection,
      loadByIdsFn: loadByIdsFn,
      responseKey: errorMessagePrefix,
      errorMessagePrefix,
    });
  }

  if (loadLinkedContactIdsFn) {
    registerLinkedContactIdsRoute(fastify, {
      path: prefix ? `${prefix}/linked-contact-ids` : "/linked-contact-ids",
      collection,
      loadLinkedContactIdsFn,
      errorMessagePrefix,
    });
  }
}

export interface StandardTenantRoutesOptions<
  TQuery,
  TRecord extends ResourceRecord,
> extends StandardExtendedRoutesOptions<TQuery, TRecord> {
  schema: ZodType<TRecord>;
  loadByIdFn?: (id: string, includeDeleted?: boolean) => Promise<unknown | null>;
  createFn?: (data: TRecord) => Promise<unknown>;
  updateFn?: (id: string, data: TRecord) => Promise<unknown | null>;
  deleteFn?: (id: string, userId: string, reason?: string) => Promise<unknown | null>;
  restoreFn?: (id: string, userId: string) => Promise<unknown | null>;
  namePlural: string;
  customPostRoute?: boolean;
  customPutRoute?: boolean;
  validateDynamicFn?: (tenant: string, data: TRecord, lang: string, user: User) => Promise<void>;
  canDelete?: (user: User) => boolean;
  onAfterCreate?: (user: User, item: unknown) => Promise<void>;
  onAfterUpdate?: (user: User, id: string, updated: unknown) => Promise<void>;
  onAfterDelete?: (user: User, id: string, deletionReason?: string) => Promise<void>;
  onAfterRestore?: (user: User, id: string) => Promise<void>;
  buildRestoreResponse?: (
    restored: unknown,
    user: User,
  ) => Promise<Record<string, unknown>> | Record<string, unknown>;
  mapRestoreError?: SoftDeleteRouteErrorMapper;
  /** Transform for single GET/POST/PUT responses (e.g. viewer-role sanitization). */
  buildSingleResponse?: (item: unknown, user: User) => Promise<unknown> | unknown;
}

/**
 * Registers all standard tenant routes (Standard Extended + CRUD).
 */
export function registerStandardTenantRoutes<
  TQuery extends { page?: number; limit?: number; includeDeleted?: string } = Record<
    string,
    unknown
  >,
  TRecord extends ResourceRecord = ResourceRecord,
>(fastify: FastifyInstance, options: StandardTenantRoutesOptions<TQuery, TRecord>): void {
  const {
    prefix,
    collection,
    listQuerySchema,
    defaultPageSize,
    errorMessagePrefix,
    nameSingular,
    namePlural,
    loadPageFn,
    loadCountFn,
    loadMetricsFn,
    loadWidgetAggregatesFn,
    loadByIdsFn,
    loadLinkedContactIdsFn,
    responseTransform,
    schema,
    loadByIdFn,
    createFn,
    updateFn,
    deleteFn,
    restoreFn,
    customPostRoute,
    customPutRoute,
    validateDynamicFn,
    canWriteDeletedCheck,
    canDelete,
    onAfterCreate,
    onAfterUpdate,
    onAfterDelete,
    onAfterRestore,
    buildRestoreResponse,
    mapRestoreError,
    buildSingleResponse,
  } = options;

  registerStandardExtendedRoutes(fastify, {
    prefix,
    collection,
    listQuerySchema,
    defaultPageSize,
    errorMessagePrefix,
    nameSingular,
    loadPageFn,
    loadCountFn,
    loadMetricsFn,
    loadWidgetAggregatesFn,
    loadByIdsFn,
    loadLinkedContactIdsFn,
    canWriteDeletedCheck,
    responseTransform,
  });

  registerResourceRoutes(fastify, {
    prefix,
    customPostRoute,
    customPutRoute,
    collection,
    schema,
    loadByIdFn,
    createFn,
    updateFn,
    deleteFn,
    restoreFn,
    nameSingular,
    namePlural,
    validateDynamicFn,
    canDelete,
    onAfterCreate,
    onAfterUpdate,
    onAfterDelete,
    onAfterRestore,
    buildRestoreResponse,
    mapRestoreError,
    buildSingleResponse,
  });
}
