import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  type WorkshopAttendanceDayBody,
  type WorkshopAttendanceMark,
  type WorkshopAttendanceStatus,
  type WorkshopDetail,
  type WorkshopScore,
  type WorkshopScoresBody,
  type WorkshopsCommandMetricsSnapshot,
} from "@mms/shared";
import {
  workshopAttendance,
  workshopEvents,
  workshopParticipants,
  workshopScores,
} from "../schema.js";
import { withTenant, withTenantRead, type TenantTransaction } from "../tenant-context.js";
import { NotFoundError, ValidationError } from "../../lib/httpErrors.js";
import { findWorkshopRow, workshopRowToRecord } from "./workshopEventsRepository.js";
import { listActiveParticipants } from "./workshopParticipantsRepository.js";

async function listAttendance(
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
    .where(
      and(
        eq(workshopAttendance.workspaceSubdomain, subdomain),
        eq(workshopAttendance.workshopId, workshopId),
      ),
    )
    .orderBy(asc(workshopAttendance.dayOn));
  return rows.map((row) => ({ ...row, status: row.status as WorkshopAttendanceStatus }));
}

async function listScores(
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
    return {
      workshop: workshopRowToRecord(row, participants.length),
      participants,
      attendance: await listAttendance(tx, subdomain, id),
      scores: await listScores(tx, subdomain, id),
    };
  });
}

/** Rejects ids that are not active participants of this (active) workshop. */
async function requireParticipants(
  tx: TenantTransaction,
  subdomain: string,
  workshopId: string,
  participantIds: string[],
): Promise<void> {
  const workshop = await findWorkshopRow(tx, subdomain, workshopId);
  if (!workshop) throw new NotFoundError("Workshop not found");
  const unique = [...new Set(participantIds)];
  const found = await tx
    .select({ id: workshopParticipants.id })
    .from(workshopParticipants)
    .where(
      and(
        eq(workshopParticipants.workspaceSubdomain, subdomain),
        eq(workshopParticipants.workshopId, workshopId),
        inArray(workshopParticipants.id, unique),
        isNull(workshopParticipants.deletedAt),
      ),
    );
  if (found.length !== unique.length) {
    throw new ValidationError("Every row must name an active participant of this workshop");
  }
}

export async function saveAttendanceDay(
  tenant: string,
  workshopId: string,
  body: WorkshopAttendanceDayBody,
  markedBy: string | null,
): Promise<WorkshopAttendanceMark[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const workshop = await findWorkshopRow(tx, subdomain, workshopId);
    if (!workshop) throw new NotFoundError("Workshop not found");
    const outside =
      (workshop.startDate && body.dayOn < workshop.startDate) ||
      (workshop.endDate && body.dayOn > workshop.endDate);
    if (outside) throw new ValidationError("Check-in day is outside the workshop dates");
    await requireParticipants(
      tx,
      subdomain,
      workshopId,
      body.marks.map((mark) => mark.participantId),
    );
    await tx
      .insert(workshopAttendance)
      .values(
        body.marks.map((mark) => ({
          id: `${mark.participantId}:${body.dayOn}`,
          workspaceSubdomain: subdomain,
          workshopId,
          participantId: mark.participantId,
          dayOn: body.dayOn,
          status: mark.status,
          markedBy,
        })),
      )
      .onConflictDoUpdate({
        target: [
          workshopAttendance.workspaceSubdomain,
          workshopAttendance.participantId,
          workshopAttendance.dayOn,
        ],
        set: {
          status: sql`excluded.status`,
          markedBy: sql`excluded.marked_by`,
          updatedAt: new Date(),
        },
      });
    return listAttendance(tx, subdomain, workshopId);
  });
}

export async function saveScores(
  tenant: string,
  workshopId: string,
  body: WorkshopScoresBody,
): Promise<WorkshopScore[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    await requireParticipants(
      tx,
      subdomain,
      workshopId,
      body.scores.map((line) => line.participantId),
    );
    await tx
      .insert(workshopScores)
      .values(
        body.scores.map((line) => ({
          id: crypto.randomUUID(),
          workspaceSubdomain: subdomain,
          workshopId,
          participantId: line.participantId,
          criterionName: line.criterionName,
          score: line.score.toFixed(2),
          maxScore: line.maxScore.toFixed(2),
          remarks: line.remarks ?? null,
        })),
      )
      .onConflictDoUpdate({
        target: [
          workshopScores.workspaceSubdomain,
          workshopScores.participantId,
          workshopScores.criterionName,
        ],
        set: {
          score: sql`excluded.score`,
          maxScore: sql`excluded.max_score`,
          remarks: sql`excluded.remarks`,
          updatedAt: new Date(),
        },
      });
    return listScores(tx, subdomain, workshopId);
  });
}

/** Counts relative to `today` (YYYY-MM-DD); events without dates count toward the total only. */
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
        upcoming: sql<number>`count(*) filter (where ${workshopEvents.startDate} > ${today}::date)::int`,
        ongoing: sql<number>`count(*) filter (where ${workshopEvents.startDate} <= ${today}::date and ${lastDay} >= ${today}::date)::int`,
        finished: sql<number>`count(*) filter (where ${lastDay} < ${today}::date)::int`,
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
          isNull(workshopEvents.deletedAt),
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
