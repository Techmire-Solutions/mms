import { and, eq, isNull, sql } from "drizzle-orm";
import type { ObligationsReportAggregates } from "@mms/shared";
import { obligationCollections, obligationTypes, mujtahidReps } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";

export type ObligationsReportQuery = {
  dateFrom?: string;
  dateTo?: string;
  typeId?: string;
  repId?: string;
};

/** SQL aggregates for Obligations Reports tier. */
export async function aggregateObligationsReport(
  tenant: string,
  query: ObligationsReportQuery = {},
): Promise<ObligationsReportAggregates> {
  const subdomain = tenant.trim().toLowerCase();

  return withTenantRead(subdomain, async (tx) => {
    const cleanTypeId = query.typeId?.trim();
    const cleanRepId = query.repId?.trim();
    const cleanDateFrom = query.dateFrom?.trim();
    const cleanDateTo = query.dateTo?.trim();
    const baseWhere = and(
      eq(obligationCollections.workspaceSubdomain, subdomain),
      isNull(obligationCollections.deletedAt),
      cleanTypeId ? eq(obligationCollections.obligationTypeId, cleanTypeId) : undefined,
      cleanRepId ? eq(obligationCollections.mujtahidRepresentativeId, cleanRepId) : undefined,
      cleanDateFrom
        ? sql`(${obligationCollections.receivedDate})::date >= ${cleanDateFrom}::date`
        : undefined,
      cleanDateTo
        ? sql`(${obligationCollections.receivedDate})::date <= ${cleanDateTo}::date`
        : undefined,
    );

    // Totals
    const [totalsRow] = await tx
      .select({
        total: sql<number>`count(*)::int`,
        totalAmount: sql<number>`coalesce(sum(${obligationCollections.amount}), 0)::float8`,
        uniqueReps: sql<number>`count(distinct ${obligationCollections.mujtahidRepresentativeId})::int`,
      })
      .from(obligationCollections)
      .where(baseWhere);

    // Type breakdown
    const typeBreakdownRows = await tx
      .select({
        typeId: obligationCollections.obligationTypeId,
        typeName: obligationTypes.name,
        count: sql<number>`count(*)::int`,
        amount: sql<number>`coalesce(sum(${obligationCollections.amount}), 0)::float8`,
      })
      .from(obligationCollections)
      .leftJoin(
        obligationTypes,
        and(
          eq(obligationCollections.obligationTypeId, obligationTypes.id),
          eq(obligationTypes.workspaceSubdomain, subdomain),
        ),
      )
      .where(baseWhere)
      .groupBy(obligationCollections.obligationTypeId, obligationTypes.name);

    // Monthly trend (last 12 months)
    const monthlyTrendRows = await tx
      .select({
        monthKey: sql<string>`to_char((${obligationCollections.receivedDate})::date, 'YYYY-MM')`,
        count: sql<number>`count(*)::int`,
        amount: sql<number>`coalesce(sum(${obligationCollections.amount}), 0)::float8`,
      })
      .from(obligationCollections)
      .where(
        and(
          baseWhere,
          sql`${obligationCollections.receivedDate} IS NOT NULL`,
          sql`(${obligationCollections.receivedDate})::date >= (now() - interval '12 months')::date`,
        ),
      )
      .groupBy(sql`to_char((${obligationCollections.receivedDate})::date, 'YYYY-MM')`)
      .orderBy(sql`to_char((${obligationCollections.receivedDate})::date, 'YYYY-MM') ASC`);

    // Rep summary
    const repSummaryRows = await tx
      .select({
        repId: obligationCollections.mujtahidRepresentativeId,
        repName: mujtahidReps.name,
        count: sql<number>`count(*)::int`,
        amount: sql<number>`coalesce(sum(${obligationCollections.amount}), 0)::float8`,
      })
      .from(obligationCollections)
      .leftJoin(
        mujtahidReps,
        and(
          eq(obligationCollections.mujtahidRepresentativeId, mujtahidReps.id),
          eq(mujtahidReps.workspaceSubdomain, subdomain),
        ),
      )
      .where(baseWhere)
      .groupBy(obligationCollections.mujtahidRepresentativeId, mujtahidReps.name);

    const monthlyTrend: Array<{ monthKey: string; count: number; amount: number }> = [];
    for (let i = 0; i < monthlyTrendRows.length; i++) {
      const r = monthlyTrendRows[i];
      if (r?.monthKey) {
        monthlyTrend.push({
          monthKey: r.monthKey,
          count: Number(r.count),
          amount: Number(r.amount),
        });
      }
    }

    return {
      totalCollections: Number(totalsRow?.total ?? 0),
      totalAmount: Number(totalsRow?.totalAmount ?? 0),
      uniqueReps: Number(totalsRow?.uniqueReps ?? 0),
      typeBreakdown: typeBreakdownRows.map((r) => ({
        typeId: r.typeId ?? "",
        typeName: r.typeName ?? r.typeId ?? "",
        count: Number(r.count),
        amount: Number(r.amount),
      })),
      monthlyTrend,
      // wakalaSummary requires joining via distributions — omitted at tier-1;
      // distributions carry wakala breakdown and are already available client-side.
      wakalaSummary: [],
      repSummary: repSummaryRows.map((r) => ({
        repId: r.repId ?? "",
        repName: r.repName ?? r.repId ?? "",
        count: Number(r.count),
        amount: Number(r.amount),
      })),
    };
  });
}
