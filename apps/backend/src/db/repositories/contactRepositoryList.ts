import {
  dedupeTrimmedIds,
  isQueryFlagTrue,
  type ContactsListPageResult,
  type ContactsListQuery,
} from "@mms/shared";
import { contacts } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";
import { enableIncludeDeleted } from "../../lib/softDeleteHelpers.js";
import { runListPage } from "./listPageHelper.js";
import { hydrateContactsList, hydrateContactsSummaryList } from "./contactRepositoryCore.js";
import { hydrateContactsRecipientList } from "./contactRepositoryRecipientHydrate.js";
import { buildListConditions, buildOrderBy } from "./contactRepositoryListFilter.js";
import { contactSelectColumns } from "./contactRepositoryColumns.js";

/**
 * SQL-filtered contacts Work list page (typed columns & relational search/joins).
 * Search approximates normalizeSearchString (NFD + Yeh/Kaf + harakat) via SQL.
 *
 * The projection is the single `contactSelectColumns` map: the list used to own a
 * second column map and the two drifted (missing restore/notes columns silently
 * hydrated as `undefined` under the `$inferSelect` cast).
 */
export async function listContactsPage(
  tenant: string,
  query: ContactsListQuery & {
    afterId?: string;
    skipCount?: boolean;
    recipientProjection?: boolean;
  },
): Promise<ContactsListPageResult & { nextCursor?: string }> {
  const subdomain = tenant.trim().toLowerCase();
  const excludeIds = dedupeTrimmedIds(query.excludeIds ?? []);
  const includeIds =
    query.includeIds === undefined ? undefined : dedupeTrimmedIds(query.includeIds);

  if (includeIds && includeIds.length === 0) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(Math.max(1, query.limit ?? 50), 100);
    return { contacts: [], total: 0, page, limit, hasMore: false };
  }

  return withTenantRead(subdomain, async (tx) => {
    // Trash reads need the soft-delete GUC under the restrictive RLS policy.
    if (isQueryFlagTrue(query.includeDeleted)) await enableIncludeDeleted(tx);
    const result = await runListPage(tx, contacts, {
      conditions: buildListConditions(subdomain, query, excludeIds, includeIds),
      orderBy: buildOrderBy(query.sortField, query.sortDir),
      columns: contactSelectColumns,
      page: query.page,
      limit: query.limit,
      afterId: query.afterId,
      skipCount: query.skipCount,
      defaultPageSize: 50,
      rowMapper: (row) => row as typeof contacts.$inferSelect,
    });

    const pageContacts = query.recipientProjection
      ? await hydrateContactsRecipientList(tx, subdomain, result.items)
      : query.fullHydration
        ? await hydrateContactsList(tx, subdomain, result.items)
        : await hydrateContactsSummaryList(tx, subdomain, result.items);
    return {
      contacts: pageContacts,
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasMore: result.hasMore,
      ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}),
    };
  });
}
