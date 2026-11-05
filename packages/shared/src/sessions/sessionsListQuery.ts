import { z } from "zod";
import type { Session } from "./sessionTypes.js";
import { baseListQuerySchema } from "../core/apiSchemas.js";

export const sessionsListQuerySchema = baseListQuerySchema.extend({
  status: z.string().max(200).optional(),
  type: z.string().max(200).optional(),
});

export type SessionsListQuery = z.infer<typeof sessionsListQuerySchema>;

export interface SessionsListPageResult {
  sessions: Session[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
