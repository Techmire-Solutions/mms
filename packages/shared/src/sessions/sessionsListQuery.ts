import { z } from "zod";
import type { Session } from "./sessionTypes.js";
import { baseListQuerySchema } from "../core/apiSchemas.js";

export const sessionsListQuerySchema = baseListQuerySchema
  .extend({
    status: z.string().trim().max(200).optional(),
    type: z.string().trim().max(200).optional(),
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
}
