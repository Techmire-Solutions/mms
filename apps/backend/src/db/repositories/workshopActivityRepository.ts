import { and, asc, eq, isNull, sql } from "drizzle-orm";
import {
  workshopAttendanceStatusSchema,
  type WorkshopAttendanceMark,
  type WorkshopDetail,
  type WorkshopScore,
  type WorkshopsCommandMetricsSnapshot,
} from "@mms/shared";
import {
  workshopAttendance,
  workshopEvents,
  workshopParticipants,
  workshopScores,
} from "../schema.js";
import { withTenantRead, type TenantTransaction } from "../tenant-context.js";
import { findWorkshopRow, workshopRowToRecord } from "./workshopEventsRepository.js";
import {
  listActiveParticipants,
  listWaitlistedParticipants,
} from "./workshopParticipantsRepository.js";
import { workshopToday } from "./workshopClock.js";

export async function listAttendance(
  tx: TenantTransaction,
  subdomain: string,
  workshopId: string,
): Promise<WorkshopAttendanceMark[]> {
  const rows = await tx
    .select({
      participantId: workshopAttendance.participantId,
      dayOn: workshopAttendance.dayOn,
      status: workshopAttendance.status,
    })
    .from(workshopAttendance)
    // Withdrawn participants keep their historical marks, but the workshop payload must not
    // re-publish them (`soft-delete` §1: enforce deleted_at across joins, not just the parent read).
    .innerJoin(
      workshopParticipants,
      and(
        eq(workshopParticipants.workspaceSubdomain, workshopAttendance.workspaceSubdomain),
        eq(workshopParticipants.id, workshopAttendance.participantId),
        isNull(workshopParticipants.deletedAt),
      ),
    )
    .where(
      and(
        eq(workshopAttendance.workspaceSubdomain, subdomain),
        eq(workshopAttendance.workshopId, workshopId),
      ),
    )
    .orderBy(asc(workshopAttendance.dayOn));
  return rows.map((row) => ({
    ...row,
    status: workshopAttendanceStatusSchema.parse(row.status),
  }));
}

export async function listScores(
  tx: TenantTransaction,
  subdomain: string,
  workshopId: string,
): Promise<WorkshopScore[]> {
  const rows = await tx
    .select({
      id: workshopScores.id,
      participantId: workshopScores.participantId,
      criterionName: workshopScores.criterionName,
      score: workshopScores.score,
      maxScore: workshopScores.maxScore,
      remarks: workshopScores.remarks,
    })
    .from(workshopScores)
    .innerJoin(
      workshopParticipants,
      and(
        eq(workshopParticipants.workspaceSubdomain, workshopScores.workspaceSubdomain),
        eq(workshopParticipants.id, workshopScores.participantId),
        isNull(workshopParticipants.deletedAt),
      ),
    )
    .where(
      and(
        eq(workshopScores.workspaceSubdomain, subdomain),
        eq(workshopScores.workshopId, workshopId),
      ),
    )
    .orderBy(asc(workshopScores.criterionName));
  return rows.map((row) => ({ ...row, score: Number(row.score), maxScore: Number(row.maxScore) }));
}

export async function loadWorkshopDetail(
  tenant: string,
  id: string,
): Promise<WorkshopDetail | null> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const row = await findWorkshopRow(tx, subdomain, id, { includeDeleted: true });
    if (!row) return null;
    const participants = await listActiveParticipants(tx, subdomain, id);
    const waitlisted = await listWaitlistedParticipants(tx, subdomain, id);
    const today = await workshopToday(subdomain);
    return {
      workshop: workshopRowToRecord(row, participants.length, today),
      participants,
      waitlisted,
      waitlistCount: waitlisted.length,
      attendance: await listAttendance(tx, subdomain, id),
      scores: await listScores(tx, subdomain, id),
    };
  });
}

/** Rejects ids that are not active participants of this (active) workshop. */

export async function aggregateWorkshopsMetrics(
  tenant: string,
  today: string,
): Promise<WorkshopsCommandMetricsSnapshot> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const lastDay = sql`coalesce(${workshopEvents.endDate}, ${workshopEvents.startDate})`;
    const [events] = await tx
      .select({
        total: sql<number>`count(*)::int`,
        upcoming: sql<number>`count(*) filter (where ${workshopEvents.status} = 'open' and ${workshopEvents.startDate} > ${today}::date)::int`,
        ongoing: sql<number>`count(*) filter (where ${workshopEvents.status} = 'open' and ${workshopEvents.startDate} <= ${today}::date and ${lastDay} >= ${today}::date)::int`,
        finished: sql<number>`count(*) filter (where ${workshopEvents.status} = 'completed' or (${workshopEvents.status} = 'open' and ${lastDay} < ${today}::date))::int`,
      })
      .from(workshopEvents)
      .where(
        and(eq(workshopEvents.workspaceSubdomain, subdomain), isNull(workshopEvents.deletedAt)),
      );
    const [people] = await tx
      .select({ participants: sql<number>`count(*)::int` })
      .from(workshopParticipants)
      .innerJoin(
        workshopEvents,
        and(
          eq(workshopEvents.workspaceSubdomain, workshopParticipants.workspaceSubdomain),
          eq(workshopEvents.id, workshopParticipants.workshopId),
        ),
      )
      .where(
        and(
          eq(workshopParticipants.workspaceSubdomain, subdomain),
          isNull(workshopParticipants.deletedAt),
          isNull(workshopParticipants.waitlistedAt),
          isNull(workshopEvents.deletedAt),
          sql`${workshopEvents.status} <> 'cancelled'`,
        ),
      );
    return {
      total: Number(events?.total ?? 0),
      upcoming: Number(events?.upcoming ?? 0),
      ongoing: Number(events?.ongoing ?? 0),
      finished: Number(events?.finished ?? 0),
      participants: Number(people?.participants ?? 0),
    };
  });
}
