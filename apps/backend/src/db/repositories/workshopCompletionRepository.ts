import { and, eq, getTableColumns, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { DEFAULT_WORKSHOP_PREFERENCES, type WorkshopPreferences } from "@mms/shared";
import {
  workshopAttendance,
  workshopEvents,
  workshopModulePreferences,
  workshopParticipants,
  workshopScores,
} from "../schema.js";
import { withTenant, withTenantRead } from "../tenant-context.js";
import { auditRow } from "./workshopAudit.js";
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

/**
 * Everything the completion rule needs for one workshop, read in one transaction.
 *
 * Called by `evaluateCompletion` from inside its own transaction: nested `withTenantRead` joins the
 * active transaction, so the evaluation and the standing it persists come from one snapshot.
 */
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
    // Only marks inside the *current* workshop window count: an attendance row left behind by a
    // date edit must not inflate the numerator while the denominator follows the new dates.
    const firstDay = row.startDate;
    const lastDay = row.endDate ?? row.startDate;
    const attendance =
      firstDay && lastDay
        ? await tx
            .select({
              participantId: workshopAttendance.participantId,
              days: sql<number>`count(*) filter (where ${workshopAttendance.status} in ('present', 'late'))::int`,
            })
            .from(workshopAttendance)
            .where(
              and(
                eq(workshopAttendance.workspaceSubdomain, subdomain),
                eq(workshopAttendance.workshopId, workshopId),
                gte(workshopAttendance.dayOn, firstDay),
                lte(workshopAttendance.dayOn, lastDay),
                lte(workshopAttendance.dayOn, today),
              ),
            )
            .groupBy(workshopAttendance.participantId)
        : [];
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
      workshop: workshopRowToRecord(row, participants.length, today),
      participants,
      presentDays: new Map(attendance.map((a) => [a.participantId, Number(a.days)])),
      scores: new Map(
        scores.map((s) => [s.participantId, { total: Number(s.total), max: Number(s.max) }]),
      ),
    };
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
          isNull(workshopParticipants.waitlistedAt),
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
          isNull(workshopParticipants.waitlistedAt),
        ),
      )
      .innerJoin(
        workshopEvents,
        and(
          eq(workshopEvents.workspaceSubdomain, workshopAttendance.workspaceSubdomain),
          eq(workshopEvents.id, workshopAttendance.workshopId),
        ),
      )
      .where(
        and(
          eq(workshopAttendance.workspaceSubdomain, subdomain),
          inArray(workshopAttendance.workshopId, ids),
          inArray(workshopAttendance.status, ["present", "late"]),
          lte(workshopAttendance.dayOn, today),
          gte(workshopAttendance.dayOn, workshopEvents.startDate),
          lte(
            workshopAttendance.dayOn,
            sql`coalesce(${workshopEvents.endDate}, ${workshopEvents.startDate})`,
          ),
        ),
      )
      .groupBy(workshopAttendance.workshopId);
    const peopleBy = new Map(people.map((row) => [row.workshopId, row]));
    const marksBy = new Map(marks.map((row) => [row.workshopId, Number(row.present)]));
    return events.map((event) => {
      const counts = peopleBy.get(event.id);
      return {
        workshop: workshopRowToRecord(event, Number(counts?.participants ?? 0), today),
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
  return withTenant(subdomain, async (tx) => {
    const [before] = await tx
      .select({
        workspaceSubdomain: workshopModulePreferences.workspaceSubdomain,
        defaultMinAttendancePct: workshopModulePreferences.defaultMinAttendancePct,
        defaultMinScorePct: workshopModulePreferences.defaultMinScorePct,
        updatedAt: workshopModulePreferences.updatedAt,
      })
      .from(workshopModulePreferences)
      .where(eq(workshopModulePreferences.workspaceSubdomain, subdomain))
      .limit(1);
    await tx
      .insert(workshopModulePreferences)
      .values({ workspaceSubdomain: subdomain, ...values })
      .onConflictDoUpdate({
        target: workshopModulePreferences.workspaceSubdomain,
        set: { ...values, updatedAt: new Date() },
      });
    const saved = await loadWorkshopPreferences(subdomain);
    await auditRow(tx, {
      workspaceSubdomain: subdomain,
      tableName: "workshop_module_preferences",
      recordId: subdomain,
      actionType: before ? "UPDATE" : "CREATE",
      subjectId: subdomain,
      ...(before ? { oldState: before } : {}),
      newState: saved,
      minimizeDelta: false,
    });
    return saved;
  });
}
