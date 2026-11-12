import {
  asc,
  desc,
  eq,
  ilike,
  isNotNull,
  isNull,
  or,
  sql,
  type AnyColumn,
  type SQL,
} from "drizzle-orm";
import { isQueryFlagTrue, toSqlSearchPattern, type BaseListQuery } from "@mms/shared";
import { workshopEvents } from "../schema.js";

/**
 * WHERE/ORDER BY builders for the workshop Work list.
 *
 * Split out of `workshopEventsRepository.ts` for the 300-line band; the ordering rule below is the
 * reason this is not inlined: SQL does not define an order for rows that tie on the sort column, so
 * paginating a list of same-day workshops would repeat or drop rows between pages. Every sort is
 * therefore followed by the primary key as a deterministic tiebreaker
 * (`contactRepositoryListFilter.ts` uses the same rule).
 */

export const SORT_COLUMNS: Record<string, AnyColumn> = {
  title: workshopEvents.title,
  startDate: workshopEvents.startDate,
  endDate: workshopEvents.endDate,
  registrationDeadline: workshopEvents.registrationDeadline,
  capacity: workshopEvents.capacity,
  updatedAt: workshopEvents.updatedAt,
};

export function listConditions(subdomain: string, query: BaseListQuery): SQL[] {
  const conditions: SQL[] = [eq(workshopEvents.workspaceSubdomain, subdomain)];
  conditions.push(
    isQueryFlagTrue(query.includeDeleted)
      ? isNotNull(workshopEvents.deletedAt)
      : isNull(workshopEvents.deletedAt),
  );
  const search = query.search?.trim();
  if (search) {
    const pattern = toSqlSearchPattern(search);
    conditions.push(
      or(ilike(workshopEvents.title, pattern), ilike(workshopEvents.description, pattern)) as SQL,
    );
  }
  return conditions;
}

export function orderByFor(query: BaseListQuery): SQL {
  const column = SORT_COLUMNS[query.sortField?.trim() ?? ""] ?? workshopEvents.startDate;
  const ordered = query.sortDir === "asc" ? asc(column) : desc(column);
  return sql`${ordered}, ${workshopEvents.id} asc`;
}
