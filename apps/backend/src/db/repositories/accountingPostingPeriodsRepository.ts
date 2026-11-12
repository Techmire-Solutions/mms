import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import type { FiscalYear, PostingPeriod } from "@mms/shared";
import { accountingPostingPeriods } from "../schema.js";
import { withTenant, withTenantRead } from "../tenant-context.js";

export interface PostingPeriodSeed {
  id: string;
  fiscalYearId: string;
  label: string;
  startDate: string;
  endDate: string;
  status: "open" | "closed";
}

/** Generates calendar-month posting periods with inclusive ISO day boundaries. */
export function generatePostingPeriods(
  year: Pick<FiscalYear, "id" | "startDate" | "endDate" | "status">,
): PostingPeriodSeed[] {
  const periods: PostingPeriodSeed[] = [];
  let cursor = year.startDate;
  while (cursor <= year.endDate) {
    const [yearPart, monthPart] = cursor.split("-").map(Number);
    const monthEnd = new Date(Date.UTC(yearPart!, monthPart!, 0)).toISOString().slice(0, 10);
    const endDate = monthEnd < year.endDate ? monthEnd : year.endDate;
    periods.push({
      id: `${year.id}-${cursor.slice(0, 7)}`,
      fiscalYearId: year.id,
      label: cursor.slice(0, 7),
      startDate: cursor,
      endDate,
      status: year.status === "closed" ? "closed" : "open",
    });
    cursor = new Date(Date.UTC(yearPart!, monthPart!, 1)).toISOString().slice(0, 10);
  }
  return periods;
}

export async function syncPostingPeriods(
  tx: Parameters<Parameters<typeof withTenant>[1]>[0],
  subdomain: string,
  records: FiscalYear[],
): Promise<void> {
  const periods = records.flatMap(generatePostingPeriods);
  if (periods.length === 0) return;
  await tx
    .insert(accountingPostingPeriods)
    .values(periods.map((period) => ({ ...period, workspaceSubdomain: subdomain })))
    .onConflictDoUpdate({
      target: [accountingPostingPeriods.workspaceSubdomain, accountingPostingPeriods.id],
      set: {
        label: sql`excluded.label`,
        startDate: sql`excluded.start_date`,
        endDate: sql`excluded.end_date`,
        status: sql`case when excluded.status = 'closed' then 'closed' else ${accountingPostingPeriods.status} end`,
        updatedAt: new Date(),
      },
    });
}

/** Explicit projection: a bare `.select()` would widen with every future column. */
const periodColumns = {
  id: accountingPostingPeriods.id,
  fiscalYearId: accountingPostingPeriods.fiscalYearId,
  label: accountingPostingPeriods.label,
  startDate: accountingPostingPeriods.startDate,
  endDate: accountingPostingPeriods.endDate,
  status: accountingPostingPeriods.status,
  closedAt: accountingPostingPeriods.closedAt,
  closedBy: accountingPostingPeriods.closedBy,
  updatedAt: accountingPostingPeriods.updatedAt,
};

function periodRowToRecord(row: {
  id: string;
  fiscalYearId: string;
  label: string;
  startDate: string;
  endDate: string;
  status: string;
  closedAt: Date | null;
  closedBy: string | null;
  updatedAt: Date;
}): PostingPeriod {
  return {
    id: row.id,
    fiscalYearId: row.fiscalYearId,
    label: row.label,
    startDate: row.startDate,
    endDate: row.endDate,
    status: row.status === "closed" ? "closed" : "open",
    closedAt: row.closedAt ? row.closedAt.toISOString() : null,
    closedBy: row.closedBy ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Periods of one fiscal year (all years when omitted), oldest first. */
export async function listPostingPeriods(
  tenant: string,
  fiscalYearId?: string,
): Promise<PostingPeriod[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const conditions = [eq(accountingPostingPeriods.workspaceSubdomain, subdomain)];
    const yearId = fiscalYearId?.trim();
    if (yearId) conditions.push(eq(accountingPostingPeriods.fiscalYearId, yearId));
    const rows = await tx
      .select(periodColumns)
      .from(accountingPostingPeriods)
      .where(and(...conditions))
      .orderBy(asc(accountingPostingPeriods.startDate));
    return rows.map(periodRowToRecord);
  });
}

export async function findPostingPeriodById(
  tenant: string,
  id: string,
): Promise<PostingPeriod | null> {
  const subdomain = tenant.trim().toLowerCase();
  const cleanId = id?.trim();
  if (!cleanId) return null;
  return withTenantRead(subdomain, async (tx) => {
    const [row] = await tx
      .select(periodColumns)
      .from(accountingPostingPeriods)
      .where(
        and(
          eq(accountingPostingPeriods.workspaceSubdomain, subdomain),
          eq(accountingPostingPeriods.id, cleanId),
        ),
      )
      .limit(1);
    return row ? periodRowToRecord(row) : null;
  });
}

/**
 * Label of the closed period covering `date`, or null. This is the read the
 * posting guard makes: a workspace with no periods (or no period covering the
 * date) has no monthly lock, so posting keeps working (bootstrap rule).
 */
export async function findClosedPostingPeriodForDate(
  tenant: string,
  date: string,
): Promise<string | null> {
  const subdomain = tenant.trim().toLowerCase();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return withTenantRead(subdomain, async (tx) => {
    const [row] = await tx
      .select({ label: accountingPostingPeriods.label })
      .from(accountingPostingPeriods)
      .where(
        and(
          eq(accountingPostingPeriods.workspaceSubdomain, subdomain),
          eq(accountingPostingPeriods.status, "closed"),
          lte(accountingPostingPeriods.startDate, date),
          gte(accountingPostingPeriods.endDate, date),
        ),
      )
      .limit(1);
    return row?.label ?? null;
  });
}

/**
 * Flips one period's lock state. Opens a transaction (joining the caller's when
 * one is active) so the write stays inside the caller's unit of work.
 */
export async function setPostingPeriodStatus(
  tenant: string,
  id: string,
  status: "open" | "closed",
  actorId: string,
): Promise<PostingPeriod | null> {
  const subdomain = tenant.trim().toLowerCase();
  const cleanId = id?.trim();
  if (!cleanId) return null;
  const now = new Date();
  return withTenant(subdomain, async (tx) => {
    const [row] = await tx
      .update(accountingPostingPeriods)
      .set({
        status,
        closedAt: status === "closed" ? now : null,
        closedBy: status === "closed" ? actorId : null,
        updatedAt: now,
      })
      .where(
        and(
          eq(accountingPostingPeriods.workspaceSubdomain, subdomain),
          eq(accountingPostingPeriods.id, cleanId),
        ),
      )
      .returning(periodColumns);
    return row ? periodRowToRecord(row) : null;
  });
}
