import { z } from "zod";
import { deepSanitizeStrings } from "./sanitize.js";

const softDeleteBodyBaseSchema = z
  .object({
    deletionReason: z.string().max(500).optional(),
  })
  .strict();

/** Soft-delete request body (optional audit reason). */
export const softDeleteBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, softDeleteBodyBaseSchema);

const bulkIdsBodyBaseSchema = z
  .object({
    ids: z
      .array(z.union([z.string(), z.number()]))
      .min(1)
      .max(500),
    deletionReason: z.string().max(500).optional(),
  })
  .strict();

/** Bulk soft-delete / restore body with capped id list. */
export const bulkIdsBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, bulkIdsBodyBaseSchema);

const bulkStringIdsBodyBaseSchema = z
  .object({
    ids: z.array(z.string().min(1)).min(1).max(500),
    deletionReason: z.string().max(500).optional(),
  })
  .strict();

/** String-only bulk ids (modules that never use numeric ids). */
export const bulkStringIdsBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, bulkStringIdsBodyBaseSchema);

/** Inferred type for softDeleteBodySchema. */
export type SoftDeleteBody = z.infer<typeof softDeleteBodySchema>;

/** Inferred type for bulkIdsBodySchema. */
export type BulkIdsBody = z.infer<typeof bulkIdsBodySchema>;

/** Inferred type for bulkStringIdsBodySchema. */
export type BulkStringIdsBody = z.infer<typeof bulkStringIdsBodySchema>;

/** Common route path parameter schemas */
export const resourceIdParamsSchema = z.object({ id: z.string().min(1) }).strict();
export const resourceNameParamsSchema = z.object({ name: z.string().min(1) }).strict();
export const resourceKeyParamsSchema = z.object({ key: z.string().min(1) }).strict();
export const subdomainParamsSchema = z.object({ subdomain: z.string().min(1) }).strict();
export const subdomainUserIdParamsSchema = z
  .object({
    subdomain: z.string().min(1),
    userId: z.string().min(1),
  })
  .strict();

export type ResourceIdParams = z.infer<typeof resourceIdParamsSchema>;
export type ResourceNameParams = z.infer<typeof resourceNameParamsSchema>;
export type ResourceKeyParams = z.infer<typeof resourceKeyParamsSchema>;
export type SubdomainParams = z.infer<typeof subdomainParamsSchema>;
export type SubdomainUserIdParams = z.infer<typeof subdomainUserIdParamsSchema>;

/** Query schema for linked contact ids endpoint */
export const linkedContactIdsQuerySchema = z
  .object({
    excludeId: z.string().optional(),
  })
  .strict();

export type LinkedContactIdsQuery = z.infer<typeof linkedContactIdsQuerySchema>;

import type { SoftDeleteListFilter } from "../core/softDelete.js";

/** Authoritative repository list and pagination options */
export interface RepositoryListOptions {
  limit?: number;
  offset?: number;
  deleted?: SoftDeleteListFilter;
  includeDeleted?: boolean;
  search?: string;
  sortField?: string;
  sortDir?: "asc" | "desc" | "";
}

/** Contacts duplicate scan query schema with strict 100 limit budget */
export const contactsDuplicatesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

export type ContactsDuplicatesQuery = z.infer<typeof contactsDuplicatesQuerySchema>;
