import type { ZodType } from "zod";
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
  responseKey: string;
  errorMessagePrefix: string;
  /** When true, omits registering the GET endpoint (e.g. handled by @ts-rest contract router). */
  customGetRoute?: boolean;
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
