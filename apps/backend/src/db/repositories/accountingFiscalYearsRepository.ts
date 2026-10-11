import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { dedupeTrimmedIds, type FiscalYear } from "@mms/shared";
import { accountingFiscalYears, accountingPostingPeriods } from "../schema.js";
import { withTenant, withTenantRead } from "../tenant-context.js";
import { mapAuditTimestamps } from "./repositoryMappers.js";

type FiscalYearRow = typeof accountingFiscalYears.$inferSelect;

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

async function syncPostingPeriods(
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

export function fiscalYearRowToRecord(row: FiscalYearRow): FiscalYear {
  const fiscalYear: FiscalYear = {
    id: row.id,
    label: row.label,
    startDate: row.startDate,
    endDate: row.endDate,
    status: row.status as FiscalYear["status"],
    ...mapAuditTimestamps(row),
  };

  if (row.closedAt) fiscalYear.closedAt = row.closedAt.toISOString();
  if (row.closedBy) fiscalYear.closedBy = row.closedBy;

  return fiscalYear;
}

export async function listFiscalYearsByWorkspace(
  tenant: string,
  options?: { deleted?: "active" | "deleted" | "all"; includeDeleted?: boolean },
): Promise<FiscalYear[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const isDeletedOnly = options?.deleted === "deleted";
    const isAll = options?.deleted === "all";
    const deletedCond = isDeletedOnly
      ? isNotNull(accountingFiscalYears.deletedAt)
      : isAll
        ? null
        : options?.includeDeleted
          ? isNotNull(accountingFiscalYears.deletedAt)
          : isNull(accountingFiscalYears.deletedAt);

    const conditions = [eq(accountingFiscalYears.workspaceSubdomain, subdomain)];
    if (deletedCond) conditions.push(deletedCond);

    const rows = await tx
      .select({
        id: accountingFiscalYears.id,
        workspaceSubdomain: accountingFiscalYears.workspaceSubdomain,
        label: accountingFiscalYears.label,
        startDate: accountingFiscalYears.startDate,
        endDate: accountingFiscalYears.endDate,
        status: accountingFiscalYears.status,
        closedAt: accountingFiscalYears.closedAt,
        closedBy: accountingFiscalYears.closedBy,
        deletedAt: accountingFiscalYears.deletedAt,
        deletedBy: accountingFiscalYears.deletedBy,
        deletionReason: accountingFiscalYears.deletionReason,
        restoredAt: accountingFiscalYears.restoredAt,
        restoredBy: accountingFiscalYears.restoredBy,
        deletedWithCascade: accountingFiscalYears.deletedWithCascade,
        createdAt: accountingFiscalYears.createdAt,
        updatedAt: accountingFiscalYears.updatedAt,
      })
      .from(accountingFiscalYears)
      .where(and(...conditions));
    return rows.map(fiscalYearRowToRecord);
  });
}

export async function findFiscalYearById(tenant: string, id: string): Promise<FiscalYear | null> {
  const trimmedId = id?.trim();
  if (!trimmedId) return null;
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: accountingFiscalYears.id,
        workspaceSubdomain: accountingFiscalYears.workspaceSubdomain,
        label: accountingFiscalYears.label,
        startDate: accountingFiscalYears.startDate,
        endDate: accountingFiscalYears.endDate,
        status: accountingFiscalYears.status,
        closedAt: accountingFiscalYears.closedAt,
        closedBy: accountingFiscalYears.closedBy,
        deletedAt: accountingFiscalYears.deletedAt,
        deletedBy: accountingFiscalYears.deletedBy,
        deletionReason: accountingFiscalYears.deletionReason,
        restoredAt: accountingFiscalYears.restoredAt,
        restoredBy: accountingFiscalYears.restoredBy,
        deletedWithCascade: accountingFiscalYears.deletedWithCascade,
        createdAt: accountingFiscalYears.createdAt,
        updatedAt: accountingFiscalYears.updatedAt,
      })
      .from(accountingFiscalYears)
      .where(
        and(
          eq(accountingFiscalYears.workspaceSubdomain, subdomain),
          eq(accountingFiscalYears.id, trimmedId),
        ),
      )
      .limit(1);
    const row = rows[0];
    return row ? fiscalYearRowToRecord(row) : null;
  });
}

export async function findFiscalYearsByIds(
  tenant: string,
  ids: string[],
  options?: { deleted?: "active" | "deleted" | "all"; includeDeleted?: boolean },
): Promise<FiscalYear[]> {
  const cleanIds = dedupeTrimmedIds(ids);
  if (cleanIds.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const isDeletedOnly = options?.deleted === "deleted";
    const isAll = options?.deleted === "all";
    const deletedCond = isDeletedOnly
      ? isNotNull(accountingFiscalYears.deletedAt)
      : isAll
        ? null
        : options?.includeDeleted
          ? isNotNull(accountingFiscalYears.deletedAt)
          : isNull(accountingFiscalYears.deletedAt);

    const conditions = [
      eq(accountingFiscalYears.workspaceSubdomain, subdomain),
      inArray(accountingFiscalYears.id, cleanIds),
    ];
    if (deletedCond) conditions.push(deletedCond);

    const rows = await tx
      .select({
        id: accountingFiscalYears.id,
        workspaceSubdomain: accountingFiscalYears.workspaceSubdomain,
        label: accountingFiscalYears.label,
        startDate: accountingFiscalYears.startDate,
        endDate: accountingFiscalYears.endDate,
        status: accountingFiscalYears.status,
        closedAt: accountingFiscalYears.closedAt,
        closedBy: accountingFiscalYears.closedBy,
        deletedAt: accountingFiscalYears.deletedAt,
        deletedBy: accountingFiscalYears.deletedBy,
        deletionReason: accountingFiscalYears.deletionReason,
        restoredAt: accountingFiscalYears.restoredAt,
        restoredBy: accountingFiscalYears.restoredBy,
        deletedWithCascade: accountingFiscalYears.deletedWithCascade,
        createdAt: accountingFiscalYears.createdAt,
        updatedAt: accountingFiscalYears.updatedAt,
      })
      .from(accountingFiscalYears)
      .where(and(...conditions));
    return rows.map(fiscalYearRowToRecord);
  });
}

export async function saveFiscalYear(tenant: string, record: FiscalYear): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(accountingFiscalYears)
      .values({
        id: record.id,
        workspaceSubdomain: subdomain,
        label: record.label,
        startDate: record.startDate,
        endDate: record.endDate,
        status: record.status ?? "upcoming",
        closedAt: record.closedAt ? new Date(record.closedAt) : null,
        closedBy: record.closedBy ?? null,
        deletedAt: record.deletedAt ? new Date(record.deletedAt) : null,
        deletedBy: record.deletedBy ?? null,
        deletionReason: record.deletionReason ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [accountingFiscalYears.workspaceSubdomain, accountingFiscalYears.id],
        set: {
          label: record.label,
          startDate: record.startDate,
          endDate: record.endDate,
          status: record.status ?? "upcoming",
          closedAt: record.closedAt ? new Date(record.closedAt) : null,
          closedBy: record.closedBy ?? null,
          deletedAt: record.deletedAt ? new Date(record.deletedAt) : null,
          deletedBy: record.deletedBy ?? null,
          deletionReason: record.deletionReason ?? null,
          updatedAt: new Date(),
        },
      });
    await syncPostingPeriods(tx, subdomain, [record]);
  });
}

function toFiscalYearRow(r: FiscalYear, subdomain: string) {
  return {
    id: r.id,
    workspaceSubdomain: subdomain,
    label: r.label,
    startDate: r.startDate,
    endDate: r.endDate,
    status: r.status ?? "upcoming",
    closedAt: r.closedAt ? new Date(r.closedAt) : null,
    closedBy: r.closedBy ?? null,
    deletedAt: r.deletedAt ? new Date(r.deletedAt) : null,
    deletedBy: r.deletedBy ?? null,
    deletionReason: r.deletionReason ?? null,
    updatedAt: new Date(),
  };
}

function dedupeFiscalYears(records: FiscalYear[]): FiscalYear[] {
  const map = new Map<string, FiscalYear>();
  for (const r of records) {
    const cleanId = typeof r.id === "string" ? r.id.trim() : String(r.id);
    if (cleanId) map.set(cleanId, { ...r, id: cleanId });
  }
  return Array.from(map.values());
}

export async function bulkSaveFiscalYears(tenant: string, records: FiscalYear[]): Promise<void> {
  if (records.length === 0) return;
  const subdomain = tenant.trim().toLowerCase();
  const uniqueRecords = dedupeFiscalYears(records);
  if (uniqueRecords.length === 0) return;

  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(accountingFiscalYears)
      .values(uniqueRecords.map((r) => toFiscalYearRow(r, subdomain)))
      .onConflictDoUpdate({
        target: [accountingFiscalYears.workspaceSubdomain, accountingFiscalYears.id],
        set: {
          label: sql`excluded.label`,
          startDate: sql`excluded.start_date`,
          endDate: sql`excluded.end_date`,
          status: sql`excluded.status`,
          closedAt: sql`excluded.closed_at`,
          closedBy: sql`excluded.closed_by`,
          deletedAt: sql`excluded.deleted_at`,
          deletedBy: sql`excluded.deleted_by`,
          deletionReason: sql`excluded.deletion_reason`,
          updatedAt: new Date(),
        },
      });
    await syncPostingPeriods(tx, subdomain, uniqueRecords);
  });
}

export async function replaceFiscalYearsForWorkspace(
  tenant: string,
  records: FiscalYear[],
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  const uniqueRecords = dedupeFiscalYears(records);

  await withTenant(subdomain, async (tx) => {
    await tx
      .delete(accountingFiscalYears)
      .where(eq(accountingFiscalYears.workspaceSubdomain, subdomain));
    if (uniqueRecords.length > 0) {
      await tx
        .insert(accountingFiscalYears)
        .values(uniqueRecords.map((r) => toFiscalYearRow(r, subdomain)));
    }
  });
}
