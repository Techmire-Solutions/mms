import { z } from "zod";
import type { Session } from "./sessionTypes.js";
import { baseListQuerySchema, LIST_PAGE_MAX_LIMIT } from "./apiSchemas.js";
import { paginateArray } from "./utils.js";

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

export function filterSessionsForQuery(sessions: Session[], query: SessionsListQuery): Session[] {
  let rows = sessions;
  if (query.status?.trim()) {
    const statuses = new Set(
      query.status
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
    if (statuses.size > 0) {
      rows = rows.filter((session) => statuses.has(String(session.status)));
    }
  }
  if (query.type?.trim()) {
    const types = new Set(
      query.type
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    );
    if (types.size > 0) {
      rows = rows.filter((session) => types.has(String(session.type)));
    }
  }
  if (query.search?.trim()) {
    const search = query.search.trim().toLowerCase();
    rows = rows.filter(
      (session) =>
        session.name.toLowerCase().includes(search) ||
        session.type.toLowerCase().includes(search) ||
        (session.description ?? "").toLowerCase().includes(search),
    );
  }
  return rows;
}

const NUMERIC_SORT_FIELDS = new Set(["baseFee"]);

/** Paginates an in-memory session list (server-side data source). */
export function paginateSessions(
  sessions: Session[],
  query: SessionsListQuery,
): SessionsListPageResult {
  let rows = filterSessionsForQuery(sessions, query);
  const sortField = query.sortField?.trim();
  if (sortField) {
    const dir = query.sortDir === "desc" ? -1 : 1;
    const isNumeric = NUMERIC_SORT_FIELDS.has(sortField);
    rows = [...rows].sort((left, right) => {
      const leftRaw = Reflect.get(left, sortField);
      const rightRaw = Reflect.get(right, sortField);
      if (isNumeric) {
        const leftNum = Number(leftRaw ?? 0);
        const rightNum = Number(rightRaw ?? 0);
        return (leftNum - rightNum) * dir;
      }
      const leftValue = String(leftRaw ?? "");
      const rightValue = String(rightRaw ?? "");
      return leftValue.localeCompare(rightValue) * dir;
    });
  }
  const result = paginateArray(rows, query.page ?? 1, query.limit ?? 12, LIST_PAGE_MAX_LIMIT);
  return {
    sessions: result.items,
    total: result.total,
    page: result.page,
    limit: result.limit,
    hasMore: result.hasMore,
  };
}
