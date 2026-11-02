import { sql, type SQL } from "drizzle-orm";
import { contacts, contactPhones } from "../schema.js";
import { hasEmailSql } from "./contactRepositorySql.js";

/**
 * Raw-SQL single-query aggregate over the unaliased `contacts` table for the
 * contacts Work/Reports metrics.
 *
 * The previous implementation wrapped `hasWhatsAppSql()` — a correlated
 * scalar subquery with `ORDER BY … LIMIT 1` — in every `count(*) FILTER`.
 * Postgres planned that as a per-contact `SubPlan` (with a Sort) and executed
 * it twice on the Reports path. A single `LEFT JOIN LATERAL` evaluates the
 * primary-phone pick once per contact instead, so every count reads the same
 * `pp.digits` value.
 */
export interface ContactMetricsSqlParams {
  subdomain: string;
  periodDays: number;
  /** Anchors the 30-day windows; omit for `NOW()` (Work-tab command metrics). */
  referenceDate?: Date;
  /** `buildProfileIncompleteSql(fieldConfig)` — null when nothing is required. */
  incompleteSql?: SQL | null;
  /** Reports only: missing phone-or-email count (adds the index-backed email EXISTS). */
  includeMissingInfo?: boolean;
}

/** One row of `contactMetricsAggregateSql()`. */
export type ContactMetricsSqlRow = {
  total: number;
  whatsappCount: number;
  missingInfoCount: number;
  incompleteCount: number;
  newLast30Days: number;
  newPrior30Days: number;
  newThisPeriod: number;
  maxCreatedAt: string | null;
  signupCount: number;
};

/**
 * Primary phone's dialable digits (same CASE/concat/regexp as
 * `primaryPhoneDigitsSql`) selected once per contact by the lateral join.
 */
function primaryPhoneDigitsLateralSql(): SQL {
  return sql`
    LEFT JOIN LATERAL (
      SELECT regexp_replace(
        CASE
          WHEN NULLIF(trim(p.number), '') LIKE '+%'
            THEN trim(p.number)
          ELSE concat_ws(
            '',
            NULLIF(trim(p.country_code), ''),
            NULLIF(trim(p.number), '')
          )
        END,
        '[^0-9]',
        '',
        'g'
      ) AS digits
      FROM ${contactPhones} p
      WHERE p.workspace_subdomain = ${contacts.workspaceSubdomain}
        AND p.contact_id = ${contacts.id}
        AND NULLIF(trim(p.number), '') IS NOT NULL
      -- is_primary is NOT NULL, so DESC is equivalent to the old CASE ordering and
      -- matches contact_phones_workspace_contact_priority_idx (no per-row Sort).
      ORDER BY p.is_primary DESC, p.sort_order ASC
      LIMIT 1
    ) pp ON true
  `;
}

export function contactMetricsAggregateSql({
  subdomain,
  periodDays,
  referenceDate,
  incompleteSql,
  includeMissingInfo = false,
}: ContactMetricsSqlParams): SQL {
  const anchorSql =
    referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())
      ? sql`${referenceDate.toISOString()}::timestamptz`
      : sql`NOW()`;

  // Phone presence comes from the lateral row; email presence stays the
  // existing index-backed EXISTS (sort-free, unlike the old phone subquery).
  const missingInfoCountSql = includeMissingInfo
    ? sql`count(*) FILTER (WHERE pp.digits IS NULL OR NOT ${hasEmailSql()})::int`
    : sql`0::int`;

  const incompleteCountSql = incompleteSql
    ? sql`count(*) FILTER (WHERE ${incompleteSql})::int`
    : sql`0::int`;

  return sql`
    SELECT
      count(*)::int AS "total",
      count(*) FILTER (WHERE length(pp.digits) BETWEEN 8 AND 15)::int AS "whatsappCount",
      ${missingInfoCountSql} AS "missingInfoCount",
      ${incompleteCountSql} AS "incompleteCount",
      count(*) FILTER (
        WHERE ${contacts.createdAt} >= (${anchorSql} - INTERVAL '30 days')
      )::int AS "newLast30Days",
      count(*) FILTER (
        WHERE ${contacts.createdAt} >= (${anchorSql} - INTERVAL '60 days')
          AND ${contacts.createdAt} < (${anchorSql} - INTERVAL '30 days')
      )::int AS "newPrior30Days",
      count(*) FILTER (
        WHERE ${contacts.createdAt} >= (${anchorSql} - (${periodDays} * INTERVAL '1 day'))
      )::int AS "newThisPeriod",
      max(${contacts.createdAt})::text AS "maxCreatedAt",
      count(*)::int AS "signupCount"
    FROM ${contacts}
    ${primaryPhoneDigitsLateralSql()}
    WHERE ${contacts.workspaceSubdomain} = ${subdomain}
      AND ${contacts.deletedAt} IS NULL
  `;
}
