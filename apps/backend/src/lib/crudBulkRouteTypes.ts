import type { ZodType } from "zod";
import type { FastifyRequest } from "fastify";
import type { User } from "@mms/shared";

export interface BulkRoutesOptions<T> {
  path: string;
  collection: string;
  schema: ZodType<T>;
  loadFn?: () => Promise<unknown>;
  loadPageFn?: (query: Record<string, unknown>) => Promise<unknown>;
  /** When provided, the GET branch validates the full query (page/limit/search/sort/filters) and forwards it to `loadPageFn`. */
  listQuerySchema?: ZodType;
  /** Fallback page size when the client omits `limit` (schema path). */
  defaultPageSize?: number;
  saveFn: (data: T) => Promise<unknown>;
  /** Optional authorization / server-field stamping before save (e.g. teacher scope, `markedBy`). */
  beforeSave?: (user: User, data: T, request: FastifyRequest) => Promise<T>;
  responseKey: string;
  errorMessagePrefix: string;
  /** When true, omits registering the GET endpoint (e.g. handled by @ts-rest contract router). */
  customGetRoute?: boolean;
  /**
   * Declared shape of the `PUT …/bulk` response. Modules that declare it get the
   * same `contract_violation` protection as the hand-written routes; omitting it
   * keeps the historical unvalidated send.
   */
  responseSchema?: ZodType;
}

export type SoftDeleteRouteErrorMapper = (
  error: unknown,
) => { statusCode: number; body: Record<string, unknown> } | null;

export interface SoftDeletableBulkRoutesOptions<T> {
  path: string;
  collection: string;
  schema: ZodType<T>;
  loadFn: (options?: { includeDeleted?: boolean }) => Promise<unknown>;
  loadPageFn?: (query: Record<string, unknown>) => Promise<unknown>;
  /** When provided, the GET branch validates the full query (page/limit/search/sort/filters) and forwards it to `loadPageFn`. */
  listQuerySchema?: ZodType;
  /** Fallback page size when the client omits `limit` (schema path). */
  defaultPageSize?: number;
  saveFn: (data: T) => Promise<unknown>;
  /** Authorization / server-field stamping before save (e.g. a posting-authority gate). */
  beforeSave?: (user: User, data: T, request: FastifyRequest) => Promise<T>;
  /**
   * Authority for the bulk PUT. Defaults to `canWriteCollection`; module routes whose upsert also
   * creates/edits a controller-owned definition (e.g. examinations) pass a stronger predicate.
   */
  canSave?: (user: User) => boolean;
  deleteFn: (id: string, userId: string, reason?: string) => Promise<boolean | null | unknown>;
  restoreFn: (id: string, userId: string) => Promise<boolean | null | unknown>;
  bulkDeleteFn: (
    ids: string[],
    userId: string,
    reason?: string,
  ) => Promise<{ succeeded: number; failed: number }>;
  /** Second `userId` arg for modules that audit the restore actor. */
  bulkRestoreFn: (ids: string[], userId: string) => Promise<{ succeeded: number; failed: number }>;
  responseKey: string;
  errorMessagePrefix: string;
  nameSingular: string;
  /** Declared shape of the bulk upsert response (see {@link BulkRoutesOptions}). */
  responseSchema?: ZodType;
  /** Declared shape of the `{ success, succeeded, failed }` bulk delete/restore responses. */
  bulkResponseSchema?: ZodType;
  /** Defaults to {@link bulkIdsBodySchema}; use string-only schemas when needed. */
  bulkBodySchema?: ZodType<{ ids: Array<string | number>; deletionReason?: string }>;
  /** Map domain delete failures (e.g. posted entries, self-delete) to stable HTTP responses. */
  mapDeleteError?: SoftDeleteRouteErrorMapper;
  /** Map domain restore failures (e.g. conflicting active records) to stable HTTP responses. */
  mapRestoreError?: SoftDeleteRouteErrorMapper;
  /** Whether this module captures deletion reason. Defaults to true. When false, deletionReason is stripped. */
  captureDeletionReason?: boolean;
  canDelete?: (user: User) => boolean;
  onAfterDelete?: (user: User, id: string, reason?: string) => Promise<void>;
  onAfterRestore?: (user: User, id: string) => Promise<void>;
  onAfterBulkDelete?: (
    user: User,
    result: { succeeded: number; failed: number },
    deletionReason?: string,
  ) => Promise<void>;
  onAfterBulkRestore?: (user: User, result: { succeeded: number; failed: number }) => Promise<void>;
}

export type SoftDeletableBulkTrashRoutesOptions = {
  /** Route prefix; use `/` for module root (contacts/students plugins). */
  path?: string;
  collection: string;
  errorMessagePrefix: string;
  bulkBodySchema?: ZodType<{ ids: Array<string | number>; deletionReason?: string }>;
  bulkDeleteFn: (
    ids: string[],
    userId: string,
    reason?: string,
  ) => Promise<{ succeeded: number; failed: number }>;
  /** Second `userId` arg for modules that audit restore actor (Contacts). */
  bulkRestoreFn: (ids: string[], userId: string) => Promise<{ succeeded: number; failed: number }>;
  canDelete?: (user: User) => boolean;
  /** Whether this module captures deletion reason. Defaults to true. When false, deletionReason is stripped. */
  captureDeletionReason?: boolean;
  /** Map domain delete failures (e.g. active dependencies, restrict guards) to stable HTTP responses. */
  mapDeleteError?: SoftDeleteRouteErrorMapper;
  /** Map domain restore failures (e.g. conflicting active records) to stable HTTP responses. */
  mapRestoreError?: SoftDeleteRouteErrorMapper;
  onAfterBulkDelete?: (
    user: User,
    result: { succeeded: number; failed: number },
    deletionReason?: string,
  ) => Promise<void>;
  onAfterBulkRestore?: (user: User, result: { succeeded: number; failed: number }) => Promise<void>;
  /** Declared shape of the `{ success, succeeded, failed }` bulk delete/restore responses. */
  bulkResponseSchema?: ZodType;
};

export type BulkListLoadContext = {
  loadFn?: () => Promise<unknown>;
  loadPageFn?: (query: Record<string, unknown>) => Promise<unknown>;
  listQuerySchema?: ZodType;
  defaultPageSize?: number;
  responseKey: string;
  errorMessagePrefix: string;
  /** When true, parse `includeDeleted` and gate trash reads on delete permission. */
  supportsIncludeDeleted?: boolean;
  canDelete?: (user: User) => boolean;
};
