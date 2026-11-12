import { and, eq, getTableColumns, isNull } from "drizzle-orm";
import {
  isWorkshopWaitlistPromotable,
  type BaseListQuery,
  type WorkshopEvent,
  type WorkshopEventCreate,
  type WorkshopEventUpdate,
} from "@mms/shared";
import { workshopEvents } from "../schema.js";
import { withTenant, withTenantRead, type TenantTransaction } from "../tenant-context.js";
import { runListPage } from "./listPageHelper.js";
import {
  feeValue,
  pctValue,
  workshopRowToRecord,
  type WorkshopEventRow,
} from "./workshopEventMapping.js";
import { listConditions, orderByFor } from "./workshopEventListQuery.js";
import {
  countActiveParticipants,
  countActiveParticipantsByWorkshop,
} from "./workshopParticipantsRepository.js";
import { requireActiveCatalogRefs } from "./workshopCatalogGuard.js";
import {
  assertCapacityAboveActive,
  assertWorkshopDates,
  assertWorkshopMutable,
} from "../../workshops/domain/workshopWriteGuards.js";
import { workshopToday } from "./workshopClock.js";
import { countWaitlistedTx, promoteOldestWaitlistTx } from "./workshopWaitlistRepository.js";
import { auditRow } from "./workshopAudit.js";

export { workshopRowToRecord };
export { softDeleteWorkshops, restoreWorkshop } from "./workshopEventsTrash.js";

export interface WorkshopsPage {
  workshops: WorkshopEvent[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export async function listWorkshopsPage(
  tenant: string,
  query: BaseListQuery,
): Promise<WorkshopsPage> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const today = await workshopToday(subdomain);
    const result = await runListPage<WorkshopEventRow, WorkshopEventRow>(tx, workshopEvents, {
      conditions: listConditions(subdomain, query),
      orderBy: orderByFor(query),
      page: query.page,
      limit: query.limit,
      defaultPageSize: 15,
      rowMapper: (row) => row,
    });
    const counts = await countActiveParticipantsByWorkshop(
      tx,
      subdomain,
      result.items.map((row) => row.id),
    );
    return {
      workshops: result.items.map((row) =>
        workshopRowToRecord(row, counts.get(row.id) ?? 0, today),
      ),
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasMore: result.hasMore,
    };
  });
}

/**
 * Locks the event row (`FOR UPDATE`) when `forUpdate` is set.
 *
 * The lock is the seat-capacity mutex: registration, capacity edits, trash/restore and the
 * check-in/score writes all take it, so every read-modify-write on the workshop row serializes.
 */
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
    const today = await workshopToday(subdomain);
    const counts = await countActiveParticipantsByWorkshop(tx, subdomain, [row.id]);
    return workshopRowToRecord(row, counts.get(row.id) ?? 0, today);
  });
}

export async function insertWorkshop(
  tenant: string,
  id: string,
  input: WorkshopEventCreate,
): Promise<WorkshopEvent> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    await requireActiveCatalogRefs(tx, subdomain, {
      programId: input.programId,
      subjectId: input.subjectId,
    });
    // The route's Zod schema rejects these first; the write transaction re-checks so an importer or
    // a direct call cannot create an inverted or over-long workshop.
    assertWorkshopDates({
      startDate: input.startDate,
      endDate: input.endDate,
      registrationDeadline: input.registrationDeadline,
    });
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
        minAttendancePct: pctValue(input.minAttendancePct) ?? null,
        minScorePct: pctValue(input.minScorePct) ?? null,
        // Omitted = open (the form publishes immediately); a draft stays out of registration until
        // it is explicitly published through the lifecycle action.
        status: input.status ?? "open",
        waitlistEnabled: input.waitlistEnabled ?? false,
      })
      .returning();
    await auditRow(tx, {
      workspaceSubdomain: subdomain,
      tableName: "workshop_events",
      recordId: id,
      actionType: "CREATE",
      subjectId: id,
      newState: row,
    });
    return workshopRowToRecord(row!, 0, await workshopToday(subdomain));
  });
}

export async function updateWorkshop(
  tenant: string,
  id: string,
  patch: WorkshopEventUpdate,
): Promise<WorkshopEvent | null> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    // Lock first: a registration in flight holds this row, so the capacity check below observes
    // the committed seat count, and the UPDATE cannot interleave with one.
    const current = await findWorkshopRow(tx, subdomain, id, { forUpdate: true });
    if (!current) return null;

    // Rules that depend on the stored row are evaluated under the same lock as the write, so two
    // concurrent editors cannot both validate against a stale snapshot (the old use-case pre-read
    // validated in one transaction and wrote in another).
    assertWorkshopMutable(current);
    assertWorkshopDates({
      startDate: patch.startDate === undefined ? current.startDate : patch.startDate,
      endDate: patch.endDate === undefined ? current.endDate : patch.endDate,
      registrationDeadline:
        patch.registrationDeadline === undefined
          ? current.registrationDeadline
          : patch.registrationDeadline,
    });
    if (patch.capacity !== undefined) {
      assertCapacityAboveActive(patch.capacity, await countActiveParticipants(tx, subdomain, id));
    }
    await requireActiveCatalogRefs(tx, subdomain, {
      programId: patch.programId,
      subjectId: patch.subjectId,
    });

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
        minAttendancePct: pctValue(patch.minAttendancePct),
        minScorePct: pctValue(patch.minScorePct),
        waitlistEnabled: patch.waitlistEnabled,
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

    // A capacity increase (or removing the cap) frees seats: promote the queue oldest-first in the
    // same transaction, under the same row lock the registration path uses.
    if (patch.capacity !== undefined || patch.waitlistEnabled !== undefined) {
      const today = await workshopToday(subdomain);
      if (isWorkshopWaitlistPromotable(row, today)) {
        const seated = await countActiveParticipants(tx, subdomain, id);
        const waiting = await countWaitlistedTx(tx, subdomain, id);
        const free = row.capacity === null ? waiting : Math.max(0, row.capacity - seated);
        if (free > 0) await promoteOldestWaitlistTx(tx, subdomain, id, free);
      }
    }

    await auditRow(tx, {
      workspaceSubdomain: subdomain,
      tableName: "workshop_events",
      recordId: id,
      actionType: "UPDATE",
      subjectId: id,
      oldState: current,
      newState: { ...row, operation: "update" },
    });

    const counts = await countActiveParticipantsByWorkshop(tx, subdomain, [row.id]);
    return workshopRowToRecord(row, counts.get(row.id) ?? 0, await workshopToday(subdomain));
  });
}
