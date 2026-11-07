import { z } from "zod";
import type { Session } from "./sessionTypes.js";
import { baseListQuerySchema } from "../core/apiSchemas.js";
import { sessionStatusFilterSchema } from "./sessionStatusFilter.js";

/** Server sort fields for the Sessions Work list; shared by the backend and the UI. */
export const SESSION_SORT_FIELDS = [
  "name",
  "type",
  "status",
  "baseFee",
  "startDate",
  "endDate",
  "updatedAt",
  "createdAt",
] as const;
export type SessionSortField = (typeof SESSION_SORT_FIELDS)[number];

export const sessionsListQuerySchema = baseListQuerySchema
  .extend({
    /** Comma-separated lifecycle statuses; unknown values are rejected. */
    status: sessionStatusFilterSchema,
    type: z.string().trim().max(200).optional(),
    sortField: z.enum(SESSION_SORT_FIELDS).optional(),
    /**
     * Summary rows skip class sections/child collections (the Work table only needs counts);
     * detail surfaces fetch the full record with `GET /api/sessions/:id`.
     */
    view: z.enum(["summary", "full"]).optional(),
    /** Cursor paging is id-ordered; callers must not combine it with a custom sort. */
    afterId: z.string().trim().max(64).optional(),
  })
  .strict();
export type SessionsListView = z.infer<typeof sessionsListQuerySchema>["view"];

export type SessionsListQuery = z.infer<typeof sessionsListQuerySchema>;

export interface SessionsListPageResult {
  sessions: Session[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  /** Present when the caller paged with `afterId` (id-keyset pagination). */
  nextCursor?: string;
}
