import { z } from "zod";
import type { Exam } from "./examinationsModuleManifest.js";
import { EXAM_STATUSES } from "./examLifecycle.js";
import { LIST_PAGE_MAX_LIMIT } from "../core/apiSchemas.js";

/** Columns the exams directory may sort by — mirrors the repository's SQL whitelist. */
export const EXAM_SORT_FIELDS = ["name", "subject", "status", "date", "updatedAt"] as const;

/** Query accepted by the examinations exams list endpoint. */
export interface ExaminationsListQuery {
  page?: number;
  limit?: number;
  search?: string;
  /** Comma-separated exam statuses (`upcoming|ongoing|completed|scheduled|cancelled`). */
  status?: string;
  sortField?: string;
  sortDir?: "asc" | "desc" | "";
  includeDeleted?: boolean;
}

/**
 * Strict query schema for `GET /api/examinations/exams`.
 *
 * The previous contract reused `baseListQuerySchema`, which is `.passthrough()`: `status` was not
 * declared at all (it worked only because unknown keys slipped through), and any extra key was
 * accepted. The browser sends `status=upcoming,ongoing`, `page`, `limit`, `search` and
 * `includeDeleted`; every one is validated here, including each comma-separated status.
 */
export const examsListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(LIST_PAGE_MAX_LIMIT).optional(),
    search: z.string().max(500).optional(),
    status: z
      .string()
      .max(200)
      .optional()
      .refine(
        (value) =>
          !value ||
          value
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean)
            .every((part) => (EXAM_STATUSES as readonly string[]).includes(part)),
        { message: "Unknown exam status filter" },
      ),
    sortField: z.enum(EXAM_SORT_FIELDS).optional(),
    sortDir: z.union([z.enum(["asc", "desc"]), z.literal("")]).optional(),
    includeDeleted: z.union([z.boolean(), z.enum(["true", "false"])]).optional(),
    afterId: z.string().trim().min(1).max(128).optional(),
    skipCount: z.union([z.boolean(), z.enum(["true", "false"])]).optional(),
  })
  .strict();

/** Paginated examinations exams response. */
export interface ExaminationsListPageResult {
  exams: Exam[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
