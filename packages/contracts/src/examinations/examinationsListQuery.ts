import { z } from "zod";
import { examRecordSchema, type Exam } from "./examinationsModuleManifest.js";
import { EXAM_STATUSES } from "./examLifecycle.js";
import { LIST_PAGE_MAX_LIMIT } from "../core/apiSchemas.js";

/** Columns the exams directory may sort by — mirrors the repository's SQL whitelist. */
export const EXAM_SORT_FIELDS = ["name", "subject", "status", "date", "updatedAt"] as const;

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
export const examsPageResponseSchema = z.object({
  exams: z.array(examRecordSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  hasMore: z.boolean(),
  /** Keyset continuation for the next page, when the caller walked `afterId`. */
  nextCursor: z.string().optional(),
});

export type ExaminationsListPageResult = z.infer<typeof examsPageResponseSchema>;
/** Query accepted by the examinations exams list endpoint (derived from the wire schema). */
export type ExaminationsListQuery = z.infer<typeof examsListQuerySchema>;

/**
 * The list endpoint returns a bare `{ exams }` for an unpaged read (reports/collection) and the
 * page envelope when the caller paginates. The union is first-class here so clients narrow with
 * {@link examsFromResponse} instead of casting the response body.
 */
export const examsListResponseSchema = z.union([
  z.object({ exams: z.array(examRecordSchema) }),
  examsPageResponseSchema,
]);
export type ExaminationsListResponse = z.infer<typeof examsListResponseSchema>;

/** Extracts the exam rows from either list envelope (never casts). */
export function examsFromResponse(
  body: ExaminationsListResponse | Exam[] | null | undefined,
): Exam[] {
  if (!body) return [];
  if (Array.isArray(body)) return body;
  return Array.isArray(body.exams) ? body.exams : [];
}
