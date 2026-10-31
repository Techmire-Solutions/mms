import { and, eq, getTableColumns, inArray, isNull, lte, sql } from "drizzle-orm";
import {
  DEFAULT_WORKSHOP_PREFERENCES,
  type WorkshopCompletionStatus,
  type WorkshopPreferences,
} from "@mms/shared";
import {
  workshopAttendance,
  workshopEvents,
  workshopModulePreferences,
  workshopParticipants,
  workshopScores,
} from "../schema.js";
import { withTenant, withTenantRead } from "../tenant-context.js";
import { NotFoundError } from "../../lib/httpErrors.js";
import { findWorkshopRow, workshopRowToRecord } from "./workshopEventsRepository.js";
import { listActiveParticipants } from "./workshopParticipantsRepository.js";
import type { WorkshopEvent, WorkshopParticipant } from "@mms/shared";

export interface WorkshopCompletionInputs {
  workshop: WorkshopEvent;
  participants: WorkshopParticipant[];
  /** participantId → days marked present or late, up to and including `today`. */
  presentDays: Map<string, number>;
  /** participantId → summed score and maximum. */
  scores: Map<string, { total: number; max: number }>;
}

/** Everything the completion rule needs for one workshop, read in one transaction. */
export async function loadCompletionInputs(
  tenant: string,
  workshopId: string,
  today: string,
): Promise<WorkshopCompletionInputs> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const row = await findWorkshopRow(tx, subdomain, workshopId);
    if (!row) throw new NotFoundError("Workshop not found");
    const participants = await listActiveParticipants(tx, subdomain, workshopId);
    const attendance = await tx
      .select({
        participantId: workshopAttendance.participantId,
        days: sql<number>`count(*) filter (where ${workshopAttendance.status} in ('present', 'late'))::int`,
      })
      .from(workshopAttendance)
      .where(
        and(
          eq(workshopAttendance.workspaceSubdomain, subdomain),
          eq(workshopAttendance.workshopId, workshopId),
          lte(workshopAttendance.dayOn, today),
        ),
      )
      .groupBy(workshopAttendance.participantId);
    const scores = await tx
      .select({
        participantId: workshopScores.participantId,
        total: sql<string>`coalesce(sum(${workshopScores.score}), 0)`,
        max: sql<string>`coalesce(sum(${workshopScores.maxScore}), 0)`,
      })
      .from(workshopScores)
      .where(
        and(
          eq(workshopScores.workspaceSubdomain, subdomain),
          eq(workshopScores.workshopId, workshopId),
        ),
      )
      .groupBy(workshopScores.participantId);
    return {
      workshop: workshopRowToRecord(row, participants.length),
      participants,
      presentDays: new Map(attendance.map((a) => [a.participantId, Number(a.days)])),
      scores: new Map(
        scores.map((s) => [s.participantId, { total: Number(s.total), max: Number(s.max) }]),
      ),
    };
  });
}

/**
 * Stores each participant's evaluated status. `completed_at` is set on first completion and kept
 * while a certificate exists (a certificate cannot be un-earned by a later re-evaluation).
 */
export async function saveCompletionOutcomes(
  tenant: string,
  workshopId: string,
  outcomes: Array<{ participantId: string; status: WorkshopCompletionStatus }>,
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  if (outcomes.length === 0) return;
  await withTenant(subdomain, async (tx) => {
    for (const outcome of outcomes) {
      const completed = outcome.status === "completed";
      await tx
        .update(workshopParticipants)
        .set({
          status: outcome.status,
          completedAt: completed
            ? sql`coalesce(${workshopParticipants.completedAt}, now())`
            : sql`case when ${workshopParticipants.certificateIssuedAt} is null then null else ${workshopParticipants.completedAt} end`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(workshopParticipants.workspaceSubdomain, subdomain),
            eq(workshopParticipants.workshopId, workshopId),
            eq(workshopParticipants.id, outcome.participantId),
            isNull(workshopParticipants.deletedAt),
          ),
        );
    }
  });
}

/** Marks certificates issued for completed participants; returns the ids newly issued. */
export async function markCertificatesIssued(
  tenant: string,
  workshopId: string,
  participantIds: string[],
): Promise<string[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const conditions = [
      eq(workshopParticipants.workspaceSubdomain, subdomain),
      eq(workshopParticipants.workshopId, workshopId),
      eq(workshopParticipants.status, "completed"),
      isNull(workshopParticipants.deletedAt),
      isNull(workshopParticipants.certificateIssuedAt),
      sql`${workshopParticipants.completedAt} is not null`,
    ];
    if (participantIds.length > 0)
      conditions.push(inArray(workshopParticipants.id, participantIds));
    const issued = await tx
      .update(workshopParticipants)
      .set({ certificateIssuedAt: new Date(), updatedAt: new Date() })
      .where(and(...conditions))
      .returning({ id: workshopParticipants.id });
    return issued.map((row) => row.id);
  });
}

export interface WorkshopReportFacts {
  workshop: WorkshopEvent;
  presentMarks: number;
  completed: number;
  certificates: number;
}

/** Per active workshop: participants, present/late marks up to `today`, completions, certificates. */
export async function loadReportFacts(
  tenant: string,
  today: string,
): Promise<WorkshopReportFacts[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const events = await tx
      .select(getTableColumns(workshopEvents))
      .from(workshopEvents)
      .where(
        and(eq(workshopEvents.workspaceSubdomain, subdomain), isNull(workshopEvents.deletedAt)),
      )
      .orderBy(sql`${workshopEvents.startDate} desc nulls last`);
    if (events.length === 0) return [];
    const ids = events.map((event) => event.id);
    const people = await tx
      .select({
        workshopId: workshopParticipants.workshopId,
        participants: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where ${workshopParticipants.status} = 'completed')::int`,
        certificates: sql<number>`count(*) filter (where ${workshopParticipants.certificateIssuedAt} is not null)::int`,
      })
      .from(workshopParticipants)
      .where(
        and(
          eq(workshopParticipants.workspaceSubdomain, subdomain),
          inArray(workshopParticipants.workshopId, ids),
          isNull(workshopParticipants.deletedAt),
        ),
      )
      .groupBy(workshopParticipants.workshopId);
    const marks = await tx
      .select({ workshopId: workshopAttendance.workshopId, present: sql<number>`count(*)::int` })
      .from(workshopAttendance)
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
          inArray(workshopAttendance.workshopId, ids),
          inArray(workshopAttendance.status, ["present", "late"]),
          lte(workshopAttendance.dayOn, today),
        ),
      )
      .groupBy(workshopAttendance.workshopId);
    const peopleBy = new Map(people.map((row) => [row.workshopId, row]));
    const marksBy = new Map(marks.map((row) => [row.workshopId, Number(row.present)]));
    return events.map((event) => {
      const counts = peopleBy.get(event.id);
      return {
        workshop: workshopRowToRecord(event, Number(counts?.participants ?? 0)),
        presentMarks: marksBy.get(event.id) ?? 0,
        completed: Number(counts?.completed ?? 0),
        certificates: Number(counts?.certificates ?? 0),
      };
    });
  });
}

const pctOrNull = (value: string | null): number | null => (value === null ? null : Number(value));

export async function loadWorkshopPreferences(tenant: string): Promise<WorkshopPreferences> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const [row] = await tx
      .select({
        defaultMinAttendancePct: workshopModulePreferences.defaultMinAttendancePct,
        defaultMinScorePct: workshopModulePreferences.defaultMinScorePct,
      })
      .from(workshopModulePreferences)
      .where(eq(workshopModulePreferences.workspaceSubdomain, subdomain))
      .limit(1);
    if (!row) return DEFAULT_WORKSHOP_PREFERENCES;
    return {
      defaultMinAttendancePct: pctOrNull(row.defaultMinAttendancePct),
      defaultMinScorePct: pctOrNull(row.defaultMinScorePct),
    };
  });
}

export async function saveWorkshopPreferences(
  tenant: string,
  preferences: WorkshopPreferences,
): Promise<WorkshopPreferences> {
  const subdomain = tenant.trim().toLowerCase();
  const values = {
    defaultMinAttendancePct: preferences.defaultMinAttendancePct?.toFixed(2) ?? null,
    defaultMinScorePct: preferences.defaultMinScorePct?.toFixed(2) ?? null,
  };
  await withTenant(subdomain, (tx) =>
    tx
      .insert(workshopModulePreferences)
      .values({ workspaceSubdomain: subdomain, ...values })
      .onConflictDoUpdate({
        target: workshopModulePreferences.workspaceSubdomain,
        set: { ...values, updatedAt: new Date() },
      }),
  );
  return loadWorkshopPreferences(subdomain);
}
