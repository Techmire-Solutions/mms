import { z } from "zod";
import { type softDeleteBodySchema, type bulkIdsBodySchema } from "../schemas/api.dto.js";

/** Hard upper bound for interactive REST list `limit` (mms-performance / api-interface §6). */
export const LIST_PAGE_MAX_LIMIT = 100;

/**
 * Upper bound for the compatibility "load the whole collection" branch of the
 * accounting list contracts. Pickers (e.g. the chart-of-accounts dropdown) need
 * more than one page, but an unbounded read is how a client accidentally pulls
 * every journal entry. Truncation is reported with `truncated: true`.
 */
export const UNPAGINATED_LIST_CAP = 500;

/** Shared page/search/sort query fields used by REST list endpoints. */
export const baseListQueryFields = {
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(LIST_PAGE_MAX_LIMIT).optional(),
  search: z.string().max(500).optional(),
  sortField: z.string().max(64).optional(),
  sortDir: z.union([z.enum(["asc", "desc"]), z.literal("")]).optional(),
  includeDeleted: z.union([z.boolean(), z.enum(["true", "false"])]).optional(),
  /** Keyset pagination: fetch items after this primary key (bounded like a path id). */
  afterId: z.string().max(128).optional(),
  /** Performance optimization: skip counting total rows when only iterating pages */
  skipCount: z.union([z.boolean(), z.enum(["true", "false"])]).optional(),
};

export const baseListQuerySchema = z.object(baseListQueryFields).passthrough();

/** For a GET that accepts no query parameters: rejects anything the client slips in. */
export const emptyQuerySchema = z.object({}).strict();

/** Query flag for trash/archive list views. */
export const includeDeletedQuerySchema = z.object({
  includeDeleted: z.union([z.boolean(), z.enum(["true", "false"])]).optional(),
});

export * from "../schemas/api.dto.js";

export type BaseListQuery = z.infer<typeof baseListQuerySchema>;
export type IncludeDeletedQuery = z.infer<typeof includeDeletedQuerySchema>;
export type SoftDeleteBody = z.infer<typeof softDeleteBodySchema>;
export type BulkIdsBody = z.infer<typeof bulkIdsBodySchema>;
