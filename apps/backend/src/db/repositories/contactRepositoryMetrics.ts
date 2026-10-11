import { and, sql } from "drizzle-orm";
import {
  CONTACT_METRICS_DEFAULT_PERIOD_DAYS,
  formatContactsMonthLabels,
  type ContactsCommandMetricsSnapshot,
  type ContactsMonthlyYearCounts,
  type ContactsReportAnalyticsSnapshot,
  type FieldConfig,
} from "@mms/shared";
import { contacts } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";
import { hasEmailSql, hasPhoneSql, hasWhatsAppSql } from "./contactRepositorySql.js";
import {
  activeWorkspaceWhere,
  buildProfileIncompleteSql,
} from "./contactRepositoryAggregateHelpers.js";

export async function aggregateContactsCommandMetrics(
  tenant: string,
  fieldConfig: FieldConfig,
  options?: { periodDays?: number; duplicatePairCount?: number },
): Promise<ContactsCommandMetricsSnapshot> {
  const subdomain = tenant.trim().toLowerCase();
  const periodDays = options?.periodDays ?? CONTACT_METRICS_DEFAULT_PERIOD_DAYS;
  const incompleteSql = buildProfileIncompleteSql(fieldConfig);

  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        total: sql<number>`count(*)::int`,
        newThisPeriod: sql<number>`count(*) FILTER (WHERE
          ${contacts.createdAt} >= (NOW() - (${periodDays} * INTERVAL '1 day'))
        )::int`,
        whatsappCount: sql<number>`count(*) FILTER (WHERE ${hasWhatsAppSql()})::int`,
        incompleteCount: incompleteSql
          ? sql<number>`count(*) FILTER (WHERE ${incompleteSql})::int`
          : sql<number>`0::int`,
      })
      .from(contacts)
      .where(activeWorkspaceWhere(subdomain));

    const row = rows[0];
    return {
      total: Number(row?.total ?? 0),
      newThisPeriod: Number(row?.newThisPeriod ?? 0),
      whatsappCount: Number(row?.whatsappCount ?? 0),
      incompleteCount: Number(row?.incompleteCount ?? 0),
      duplicatePairCount: options?.duplicatePairCount ?? 0,
    };
  });
}

export async function aggregateContactsReportAnalytics(
  tenant: string,
  options?: { periodDays?: number; referenceDate?: Date },
): Promise<ContactsReportAnalyticsSnapshot> {
  const subdomain = tenant.trim().toLowerCase();
  const periodDays = options?.periodDays ?? CONTACT_METRICS_DEFAULT_PERIOD_DAYS;
  const referenceDate = options?.referenceDate ?? new Date();
  const refIso = referenceDate.toISOString();

  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        total: sql<number>`count(*)::int`,
        whatsappCount: sql<number>`count(*) FILTER (WHERE ${hasWhatsAppSql()})::int`,
        missingInfoCount: sql<number>`count(*) FILTER (WHERE NOT ${hasPhoneSql()} OR NOT ${hasEmailSql()})::int`,
        newLast30Days: sql<number>`count(*) FILTER (WHERE
          ${contacts.createdAt} >= ((${refIso}::timestamptz) - INTERVAL '30 days')
        )::int`,
        newPrior30Days: sql<number>`count(*) FILTER (WHERE
          ${contacts.createdAt} >= ((${refIso}::timestamptz) - INTERVAL '60 days')
          AND ${contacts.createdAt} < ((${refIso}::timestamptz) - INTERVAL '30 days')
        )::int`,
        newThisPeriod: sql<number>`count(*) FILTER (WHERE
          ${contacts.createdAt} >= ((${refIso}::timestamptz) - (${periodDays} * INTERVAL '1 day'))
        )::int`,
        maxCreatedAt: sql<string | null>`max(${contacts.createdAt})::text`,
        signupCount: sql<number>`count(*)::int`,
      })
      .from(contacts)
      .where(activeWorkspaceWhere(subdomain));

    const row = rows[0];
    const total = Number(row?.total ?? 0);
    const whatsappCount = Number(row?.whatsappCount ?? 0);
    const hasSignupDates = Number(row?.signupCount ?? 0) > 0;
    let growthRecentSignups30d = 0;
    let growthPriorSignups30d = 0;

    if (hasSignupDates && row?.maxCreatedAt) {
      const maxIso = new Date(row.maxCreatedAt).toISOString();
      const growthRows = await tx
        .select({
          recent: sql<number>`count(*) FILTER (WHERE
            ${contacts.createdAt} >= ((${maxIso}::timestamptz) - INTERVAL '30 days')
            AND ${contacts.createdAt} <= ${maxIso}::timestamptz
          )::int`,
          prior: sql<number>`count(*) FILTER (WHERE
            ${contacts.createdAt} >= ((${maxIso}::timestamptz) - INTERVAL '60 days')
            AND ${contacts.createdAt} < ((${maxIso}::timestamptz) - INTERVAL '30 days')
          )::int`,
        })
        .from(contacts)
        .where(activeWorkspaceWhere(subdomain));
      growthRecentSignups30d = Number(growthRows[0]?.recent ?? 0);
      growthPriorSignups30d = Number(growthRows[0]?.prior ?? 0);
    }

    return {
      total,
      activeCount: total,
      whatsappCount,
      whatsappRate: total > 0 ? Math.round((whatsappCount / total) * 100) : 0,
      missingInfoCount: Number(row?.missingInfoCount ?? 0),
      newLast30Days: Number(row?.newLast30Days ?? 0),
      newPrior30Days: Number(row?.newPrior30Days ?? 0),
      newThisPeriod: Number(row?.newThisPeriod ?? 0),
      hasSignupDates,
      growthRecentSignups30d,
      growthPriorSignups30d,
    };
  });
}

export async function aggregateContactsMonthlyCreatedCounts(
  tenant: string,
  years: number[],
  monthCount = 6,
  language = "en",
): Promise<ContactsMonthlyYearCounts[]> {
  if (years.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  const monthLabels = formatContactsMonthLabels(language, monthCount);

  return withTenantRead(subdomain, async (tx) => {
    // Single grouped query over all requested years (one scan) instead of one
    // GROUP BY query per year inside a loop → eliminates the per-year N+1.
    const rows = await tx
      .select({
        year: sql<number>`extract(year from ${contacts.createdAt})::int`,
        month: sql<string>`to_char(${contacts.createdAt}, 'MM')`,
        count: sql<number>`count(*)::int`,
      })
      .from(contacts)
      .where(
        and(
          activeWorkspaceWhere(subdomain),
          sql`extract(year from ${contacts.createdAt}) IN (${sql.join(
            years.map((year) => sql`${year}`),
            sql`, `,
          )})`,
        ),
      )
      .groupBy(
        sql`extract(year from ${contacts.createdAt})`,
        sql`to_char(${contacts.createdAt}, 'MM')`,
      );

    const byYearMonth = new Map<string, Map<string, number>>();
    for (const row of rows) {
      const yearKey = String(row.year);
      let monthMap = byYearMonth.get(yearKey);
      if (!monthMap) {
        monthMap = new Map<string, number>();
        byYearMonth.set(yearKey, monthMap);
      }
      monthMap.set(row.month, Number(row.count ?? 0));
    }

    return years.map((year) => {
      const byMonth = byYearMonth.get(String(year)) ?? new Map<string, number>();
      return {
        year,
        months: Array.from({ length: monthCount }, (_, monthIndex) => {
          const monthStr = String(monthIndex + 1).padStart(2, "0");
          return {
            month: monthLabels[monthIndex] ?? monthStr,
            count: byMonth.get(monthStr) ?? 0,
          };
        }),
      };
    });
  });
}
