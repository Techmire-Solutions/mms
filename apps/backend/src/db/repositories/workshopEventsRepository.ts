import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
  type AnyColumn,
  type SQL,
} from "drizzle-orm";
import {
  dedupeTrimmedIds,
  isQueryFlagTrue,
  toSqlSearchPattern,
  type BaseListQuery,
  type WorkshopEvent,
  type WorkshopEventCreate,
  type WorkshopEventUpdate,
} from "@mms/shared";
import { workshopEvents, workshopParticipants } from "../schema.js";
import { withTenant, withTenantRead, type TenantTransaction } from "../tenant-context.js";
import { runListPage } from "./listPageHelper.js";

type WorkshopEventRow = typeof workshopEvents.$inferSelect;

export interface WorkshopsPage {
  workshops: WorkshopEvent[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

const iso = (value: Date | null): string | null => (value ? value.toISOString() : null);

export function workshopRowToRecord(row: WorkshopEventRow, participantCount = 0): WorkshopEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    startDate: row.startDate,
    endDate: row.endDate,
    registrationDeadline: row.registrationDeadline,
    capacity: row.capacity,
    fee: row.fee === null ? null : Number(row.fee),
    programId: row.programId,
    subjectId: row.subjectId,
    participantCount,
    deletedAt: iso(row.deletedAt),
    deletedBy: row.deletedBy,
    deletionReason: row.deletionReason,
    restoredAt: iso(row.restoredAt),
    restoredBy: row.restoredBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Active participant counts for the given workshops, in one grouped query. */
async function participantCounts(
  tx: TenantTransaction,
  subdomain: string,
  ids: string[],
): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const rows = await tx
    .select({ workshopId: workshopParticipants.workshopId, count: sql<number>`count(*)::int` })
    .from(workshopParticipants)
    .where(
      and(
        eq(workshopParticipants.workspaceSubdomain, subdomain),
        inArray(workshopParticipants.workshopId, ids),
        isNull(workshopParticipants.deletedAt),
      ),
    )
    .groupBy(workshopParticipants.workshopId);
  return new Map(rows.map((row) => [row.workshopId, Number(row.count)]));
}

const SORT_COLUMNS: Record<string, AnyColumn> = {
  title: workshopEvents.title,
  startDate: workshopEvents.startDate,
  endDate: workshopEvents.endDate,
  registrationDeadline: workshopEvents.registrationDeadline,
  capacity: workshopEvents.capacity,
  updatedAt: workshopEvents.updatedAt,
};

function listConditions(subdomain: string, query: BaseListQuery): SQL[] {
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

export async function listWorkshopsPage(
  tenant: string,
  query: BaseListQuery,
): Promise<WorkshopsPage> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const column = SORT_COLUMNS[query.sortField?.trim() ?? ""] ?? workshopEvents.startDate;
    const result = await runListPage<WorkshopEventRow, WorkshopEventRow>(tx, workshopEvents, {
      conditions: listConditions(subdomain, query),
      orderBy: query.sortDir === "asc" ? asc(column) : desc(column),
      page: query.page,
      limit: query.limit,
      defaultPageSize: 15,
      rowMapper: (row) => row,
    });
    const counts = await participantCounts(
      tx,
      subdomain,
      result.items.map((row) => row.id),
    );
    return {
      workshops: result.items.map((row) => workshopRowToRecord(row, counts.get(row.id) ?? 0)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasMore: result.hasMore,
    };
  });
}

/** Locks the event row (`FOR UPDATE`) when `forUpdate` is set, so capacity checks serialize. */
export async function findWorkshopRow(
  tx: TenantTransaction,
  subdomain: string,
  id: string,
  options: { includeDeleted?: boolean; forUpdate?: boolean } = {},
): Promise<WorkshopEventRow | null> {
  const conditions = [eq(workshopEvents.workspaceSubdomain, subdomain), eq(workshopEvents.id, id)];
  if (!options.includeDeleted) conditions.push(isNull(workshopEvents.deletedAt));
  const query = tx
    .select(getTableColumns(workshopEvents))
    .from(workshopEvents)
    .where(and(...conditions))
    .limit(1);
  const rows = options.forUpdate ? await query.for("update") : await query;
  return rows[0] ?? null;
}

export async function findWorkshopById(tenant: string, id: string): Promise<WorkshopEvent | null> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const row = await findWorkshopRow(tx, subdomain, id, { includeDeleted: true });
    if (!row) return null;
    const counts = await participantCounts(tx, subdomain, [row.id]);
    return workshopRowToRecord(row, counts.get(row.id) ?? 0);
  });
}

const feeValue = (fee: number | null | undefined): string | null | undefined =>
  fee === undefined ? undefined : fee === null ? null : fee.toFixed(2);

export async function insertWorkshop(
  tenant: string,
  id: string,
  input: WorkshopEventCreate,
): Promise<WorkshopEvent> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const [row] = await tx
      .insert(workshopEvents)
      .values({
        id,
        workspaceSubdomain: subdomain,
        title: input.title,
        description: input.description ?? "",
        startDate: input.startDate ?? null,
        endDate: input.endDate ?? null,
        registrationDeadline: input.registrationDeadline ?? null,
        capacity: input.capacity ?? null,
        fee: feeValue(input.fee) ?? null,
        programId: input.programId ?? null,
        subjectId: input.subjectId ?? null,
      })
      .returning();
    return workshopRowToRecord(row!, 0);
  });
}

export async function updateWorkshop(
  tenant: string,
  id: string,
  patch: WorkshopEventUpdate,
): Promise<WorkshopEvent | null> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const [row] = await tx
      .update(workshopEvents)
      .set({
        title: patch.title,
        description: patch.description,
        startDate: patch.startDate,
        endDate: patch.endDate,
        registrationDeadline: patch.registrationDeadline,
        capacity: patch.capacity,
        fee: feeValue(patch.fee),
        programId: patch.programId,
        subjectId: patch.subjectId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(workshopEvents.workspaceSubdomain, subdomain),
          eq(workshopEvents.id, id),
          isNull(workshopEvents.deletedAt),
        ),
      )
      .returning();
    if (!row) return null;
    const counts = await participantCounts(tx, subdomain, [row.id]);
    return workshopRowToRecord(row, counts.get(row.id) ?? 0);
  });
}

export async function softDeleteWorkshops(
  tenant: string,
  ids: string[],
  deletedBy: string | null,
  deletionReason: string | null,
): Promise<{ succeeded: number; failed: number }> {
  const subdomain = tenant.trim().toLowerCase();
  const uniqueIds = dedupeTrimmedIds(ids);
  if (uniqueIds.length === 0) return { succeeded: 0, failed: 0 };
  return withTenant(subdomain, async (tx) => {
    const now = new Date();
    const updated = await tx
      .update(workshopEvents)
      .set({ deletedAt: now, deletedBy, deletionReason, updatedAt: now })
      .where(
        and(
          eq(workshopEvents.workspaceSubdomain, subdomain),
          inArray(workshopEvents.id, uniqueIds),
          isNull(workshopEvents.deletedAt),
        ),
      )
      .returning({ id: workshopEvents.id });
    return { succeeded: updated.length, failed: uniqueIds.length - updated.length };
  });
}

export async function restoreWorkshop(
  tenant: string,
  id: string,
  restoredBy: string | null,
): Promise<boolean> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const now = new Date();
    const updated = await tx
      .update(workshopEvents)
      .set({
        deletedAt: null,
        deletedBy: null,
        deletionReason: null,
        restoredAt: now,
        restoredBy,
        updatedAt: now,
      })
      .where(
        and(
          eq(workshopEvents.workspaceSubdomain, subdomain),
          eq(workshopEvents.id, id),
          isNotNull(workshopEvents.deletedAt),
        ),
      )
      .returning({ id: workshopEvents.id });
    return updated.length > 0;
  });
}
