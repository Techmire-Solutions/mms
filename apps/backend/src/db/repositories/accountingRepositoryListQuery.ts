import {
  eq,
  ilike,
  or,
  isNull,
  isNotNull,
  exists,
  type SQL,
  type AnyColumn,
  desc,
  asc,
  sql,
} from "drizzle-orm";
import { isQueryFlagTrue, toSqlSearchPattern, type AccountingListQuery } from "@mms/shared";
import {
  accountingAccounts,
  accountingEntries,
  accountingFiscalYears,
  accountingEntryTags,
  accountingJournalLines,
} from "../schema.js";

export function buildAccountListConditions(subdomain: string, query: AccountingListQuery): SQL[] {
  const conditions: SQL[] = [eq(accountingAccounts.workspaceSubdomain, subdomain)];

  if (isQueryFlagTrue(query.includeDeleted)) {
    conditions.push(isNotNull(accountingAccounts.deletedAt));
  } else {
    conditions.push(isNull(accountingAccounts.deletedAt));
  }

  const search = query.search?.trim();
  if (search) {
    const searchPattern = toSqlSearchPattern(search);
    conditions.push(
      or(
        ilike(accountingAccounts.id, searchPattern),
        ilike(accountingAccounts.code, searchPattern),
        ilike(accountingAccounts.name, searchPattern),
        ilike(accountingAccounts.type, searchPattern),
        ilike(accountingAccounts.subtype, searchPattern),
      ) as SQL,
    );
  }

  // Declared on AccountingListQuery and offered by the COA type filter, but never
  // applied — so choosing a type changed the query key and refetched an
  // identical, unfiltered page.
  const accountType = query.accountType?.trim();
  if (accountType) {
    conditions.push(eq(accountingAccounts.type, accountType));
  }

  return conditions;
}

export function buildEntryListConditions(subdomain: string, query: AccountingListQuery): SQL[] {
  const conditions: SQL[] = [eq(accountingEntries.workspaceSubdomain, subdomain)];

  if (isQueryFlagTrue(query.includeDeleted)) {
    conditions.push(isNotNull(accountingEntries.deletedAt));
  } else {
    conditions.push(isNull(accountingEntries.deletedAt));
  }

  const search = query.search?.trim();
  if (search) {
    const searchPattern = toSqlSearchPattern(search);
    conditions.push(
      or(
        ilike(accountingEntries.id, searchPattern),
        ilike(accountingEntries.ref, searchPattern),
        ilike(accountingEntries.description, searchPattern),
        ilike(accountingEntries.fiscalYear, searchPattern),
      ) as SQL,
    );
  }

  // The Journal tab has always offered a status filter and a date range, and
  // AccountingListQuery declares both, but neither reached the query: the
  // controls refetched an identical, unfiltered page.
  const status = query.status?.trim();
  if (status) {
    conditions.push(eq(accountingEntries.status, status));
  }

  const dateFrom = query.dateFrom?.trim();
  if (dateFrom) {
    conditions.push(sql`${accountingEntries.date} >= ${dateFrom}`);
  }

  const dateTo = query.dateTo?.trim();
  if (dateTo) {
    conditions.push(sql`${accountingEntries.date} <= ${dateTo}`);
  }

  // Entries carrying a line on the given account — what the General Ledger needs
  // in order to show one account's movement rather than whatever page happened
  // to be loaded.
  const accountId = query.accountId?.trim();
  if (accountId) {
    conditions.push(
      exists(
        sql`(select 1 from ${accountingJournalLines}
             where ${accountingJournalLines.workspaceSubdomain} = ${accountingEntries.workspaceSubdomain}
               and ${accountingJournalLines.entryId} = ${accountingEntries.id}
               and ${accountingJournalLines.accountId} = ${accountId})`,
      ) as SQL,
    );
  }

  // Entries carrying the given tag. The tag filter used to be browser-only, so
  // once the list pages on the server it would have narrowed each page on its own
  // and reported "no results" for pages that simply did not hold the tag.
  const tag = query.tag?.trim();
  if (tag) {
    conditions.push(
      exists(
        sql`(select 1 from ${accountingEntryTags}
             where ${accountingEntryTags.workspaceSubdomain} = ${accountingEntries.workspaceSubdomain}
               and ${accountingEntryTags.entryId} = ${accountingEntries.id}
               and ${accountingEntryTags.tag} = ${tag})`,
      ) as SQL,
    );
  }

  return conditions;
}

export function buildFiscalYearListConditions(
  subdomain: string,
  query: AccountingListQuery,
): SQL[] {
  const conditions: SQL[] = [eq(accountingFiscalYears.workspaceSubdomain, subdomain)];

  if (isQueryFlagTrue(query.includeDeleted)) {
    conditions.push(isNotNull(accountingFiscalYears.deletedAt));
  } else {
    conditions.push(isNull(accountingFiscalYears.deletedAt));
  }

  const search = query.search?.trim();
  if (search) {
    const searchPattern = toSqlSearchPattern(search);
    conditions.push(
      or(
        ilike(accountingFiscalYears.id, searchPattern),
        ilike(accountingFiscalYears.label, searchPattern),
      ) as SQL,
    );
  }

  return conditions;
}

export function buildAccountOrderBy(sortField?: string, sortDir?: "asc" | "desc" | ""): SQL {
  const field = sortField?.trim() || "createdAt";
  let column: AnyColumn;
  switch (field) {
    case "createdAt":
      column = accountingAccounts.createdAt;
      break;
    case "id":
      column = accountingAccounts.id;
      break;
    case "code":
      column = accountingAccounts.code;
      break;
    case "name":
      column = accountingAccounts.name;
      break;
    case "type":
      column = accountingAccounts.type;
      break;
    default:
      column = accountingAccounts.createdAt;
  }
  return sortDir === "asc" ? asc(column) : desc(column);
}

export function buildEntryOrderBy(sortField?: string, sortDir?: "asc" | "desc" | ""): SQL {
  const field = sortField?.trim() || "createdAt";
  let column: AnyColumn;
  switch (field) {
    case "createdAt":
      column = accountingEntries.createdAt;
      break;
    case "id":
      column = accountingEntries.id;
      break;
    case "date":
      column = accountingEntries.date;
      break;
    case "ref":
    case "reference":
      column = accountingEntries.ref;
      break;
    case "status":
      column = accountingEntries.status;
      break;
    default:
      column = accountingEntries.createdAt;
  }
  // `id` breaks ties so the order is total. Offset paging needs that: with a
  // non-unique sort key (a date is shared by every entry booked that day) two
  // requests can order the tied rows differently, showing a row on two pages
  // while skipping another entirely.
  return sortDir === "asc"
    ? sql`${asc(column)}, ${asc(accountingEntries.id)}`
    : sql`${desc(column)}, ${desc(accountingEntries.id)}`;
}

export function buildFiscalYearOrderBy(sortField?: string, sortDir?: "asc" | "desc" | ""): SQL {
  const field = sortField?.trim() || "createdAt";
  let column: AnyColumn;
  switch (field) {
    case "createdAt":
      column = accountingFiscalYears.createdAt;
      break;
    case "id":
      column = accountingFiscalYears.id;
      break;
    case "label":
    case "name":
      column = accountingFiscalYears.label;
      break;
    case "startDate":
      column = accountingFiscalYears.startDate;
      break;
    case "endDate":
      column = accountingFiscalYears.endDate;
      break;
    case "status":
      column = accountingFiscalYears.status;
      break;
    default:
      column = accountingFiscalYears.createdAt;
  }
  return sortDir === "asc" ? asc(column) : desc(column);
}
