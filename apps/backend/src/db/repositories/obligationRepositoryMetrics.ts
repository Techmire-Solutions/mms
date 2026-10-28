import { and, eq, isNull, sql } from "drizzle-orm";
import {
  MODULE_METRICS_DEFAULT_PERIOD_DAYS,
  type ObligationsCommandMetricsSnapshot,
} from "@mms/shared";
import { obligationCollections, obligationTypes } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";

/** SQL aggregates for Obligations command-centre metrics (active rows only). */
export async function aggregateObligationsCommandMetrics(
  tenant: string,
  periodDays: number = MODULE_METRICS_DEFAULT_PERIOD_DAYS,
): Promise<ObligationsCommandMetricsSnapshot> {
  const subdomain = tenant.trim().toLowerCase();
  if (!subdomain) {
    return {
      total: 0,
      totalAmount: 0,
      cash: 0,
      online: 0,
      newThisPeriod: 0,
      obligationTypes: 0,
    };
  }

  const safePeriodDays =
    Number.isFinite(periodDays) && periodDays > 0 ? periodDays : MODULE_METRICS_DEFAULT_PERIOD_DAYS;
  const periodStart = new Date(Date.now() - safePeriodDays * 86_400_000).toISOString().slice(0, 10);

  return withTenantRead(subdomain, async (tx) => {
    const activeCollections = and(
      eq(obligationCollections.workspaceSubdomain, subdomain),
      isNull(obligationCollections.deletedAt),
    );

    const [row] = await tx
      .select({
        total: sql<number>`count(*)::int`,
        totalAmount: sql<number>`coalesce(sum(${obligationCollections.amount}), 0)::float8`,
        cash: sql<number>`count(*) FILTER (WHERE ${obligationCollections.paymentMode} = 'Cash')::int`,
        online: sql<number>`count(*) FILTER (WHERE ${obligationCollections.paymentMode} = 'Online')::int`,
        newThisPeriod: sql<number>`count(*) FILTER (WHERE
          ${obligationCollections.receivedDate} >= ${periodStart}
        )::int`,
      })
      .from(obligationCollections)
      .where(activeCollections);

    const [typesRow] = await tx
      .select({ obligationTypes: sql<number>`count(*)::int` })
      .from(obligationTypes)
      .where(eq(obligationTypes.workspaceSubdomain, subdomain));

    return {
      total: Number(row?.total ?? 0),
      totalAmount: Number(row?.totalAmount ?? 0),
      cash: Number(row?.cash ?? 0),
      online: Number(row?.online ?? 0),
      newThisPeriod: Number(row?.newThisPeriod ?? 0),
      obligationTypes: Number(typesRow?.obligationTypes ?? 0),
    };
  });
}
