import { or, sql, type SQL } from "drizzle-orm";
import { normalizeSearchString, toSqlSearchPattern } from "@mms/shared";
import { contacts, contactEmails, contactAddresses, contactPhones } from "../schema.js";

export function isSyedSql(): SQL {
  return sql`${contacts.isSyed} IS TRUE`;
}

/**
 * Approximate normalizeSearchString in SQL:
 * NFD → strip Latin combining marks → strip Arabic harakat → Yeh/Kaf → lower.
 */
export function sqlNormalizeSearchExpr(expr: SQL): SQL {
  const fromChars = "\u064A\u0643";
  const toChars = "\u06CC\u06A9";
  return sql`lower(
    translate(
      regexp_replace(
        regexp_replace(
          normalize(${expr}, NFD),
          '[\u0300-\u036f]',
          '',
          'g'
        ),
        '[\u064B-\u065F\u0670]',
        '',
        'g'
      ),
      ${fromChars},
      ${toChars}
    )
  )`;
}

export function buildSearchSql(search: string): SQL | null {
  const normalized = normalizeSearchString(typeof search === "string" ? search.trim() : "");
  if (!normalized) return null;
  const pattern = toSqlSearchPattern(normalized);

  // Per-column predicates (instead of one concat_ws haystack) so each branch can
  // use its pg_trgm expression index. The expressions must stay byte-identical to
  // 0197_backend_review_hardening.sql.
  const direct = or(
    sql`${sqlNormalizeSearchExpr(sql`coalesce(${contacts.name}, '')`)} LIKE ${pattern}`,
    sql`${sqlNormalizeSearchExpr(sql`coalesce(${contacts.firstName}, '')`)} LIKE ${pattern}`,
    sql`${sqlNormalizeSearchExpr(sql`coalesce(${contacts.lastName}, '')`)} LIKE ${pattern}`,
    sql`${sqlNormalizeSearchExpr(sql`coalesce(${contacts.cnic}, '')`)} LIKE ${pattern}`,
  )!;

  const phoneMatch = sql`EXISTS (
    SELECT 1 FROM ${contactPhones} p
    WHERE p.workspace_subdomain = ${contacts.workspaceSubdomain}
      AND p.contact_id = ${contacts.id}
      AND ${sqlNormalizeSearchExpr(sql`coalesce(p.number, '')`)} LIKE ${pattern}
  )`;
  const emailMatch = sql`EXISTS (
    SELECT 1 FROM ${contactEmails} e
    WHERE e.workspace_subdomain = ${contacts.workspaceSubdomain}
      AND e.contact_id = ${contacts.id}
      AND ${sqlNormalizeSearchExpr(sql`coalesce(e.address, '')`)} LIKE ${pattern}
  )`;
  const addressMatch = sql`EXISTS (
    SELECT 1 FROM ${contactAddresses} a
    WHERE a.workspace_subdomain = ${contacts.workspaceSubdomain}
      AND a.contact_id = ${contacts.id}
      AND ${sqlNormalizeSearchExpr(
        sql`coalesce(a.line1, '') || ' ' || coalesce(a.city, '') || ' ' || coalesce(a.state, '') || ' ' || coalesce(a.country, '')`,
      )} LIKE ${pattern}
  )`;

  return or(direct, phoneMatch, emailMatch, addressMatch)!;
}
