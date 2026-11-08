import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { attendance, attendanceAbsenceAlerts } from "../schema.js";
import { withTenant, withTenantRead } from "../tenant-context.js";
import { loadCountableAttendanceSql } from "./attendanceCountableSql.js";

/**
 * Storage for the chronic-absence scan and its audited alerts.
 */

export interface ClassDayRow {
  classId: string;
  date: string;
}

export interface StudentMarkRow {
  classId: string;
  studentId: string;
  date: string;
  status: string;
}

export interface AbsenceAlertRow {
  id: string;
  classId: string;
  studentId: string;
  streakStart: string;
  streakEnd: string;
  streakLength: number;
  threshold: number;
  status: string;
  notifiedAt: Date | null;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
}

/**
 * Days on which a class was actually marked, inside `[since, ∞)`.
 *
 * A class day is the unit a streak is measured in: a student with no row on a marked class day is
 * "unmarked" (breaks the streak), while a day the class was never marked at all carries no evidence
 * either way and is excluded.
 */
export async function listClassMarkedDays(tenant: string, since: string): Promise<ClassDayRow[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .selectDistinct({ classId: attendance.classId, date: attendance.date })
      .from(attendance)
      .where(
        and(
          eq(attendance.workspaceSubdomain, subdomain),
          isNull(attendance.deletedAt),
          gte(attendance.date, since),
        ),
      );
    return rows.map((row) => ({ classId: String(row.classId), date: String(row.date) }));
  });
}

/** Countable marked rows of the window (holidays, off-days and approved leave excluded). */
export async function listCountableMarks(tenant: string, since: string): Promise<StudentMarkRow[]> {
  const subdomain = tenant.trim().toLowerCase();
  const countable = await loadCountableAttendanceSql(subdomain);
  return withTenantRead(subdomain, async (tx) => {
    const result = await tx.execute<{
      classId: string;
      studentId: string;
      date: string;
      status: string;
    }>(sql`
      SELECT a.class_id AS "classId", a.student_id AS "studentId",
             a.date_on::text AS "date", lower(trim(a.status)) AS "status"
        FROM attendance a
       WHERE a.workspace_subdomain = ${subdomain}
         AND a.deleted_at IS NULL
         AND a.date_on >= ${since}
         AND ${countable("a")}
    `);
    return (result.rows ?? []).map((row) => ({
      classId: String(row.classId),
      studentId: String(row.studentId),
      date: String(row.date).slice(0, 10),
      status: String(row.status),
    }));
  });
}

export interface UpsertAbsenceAlertInput {
  classId: string;
  studentId: string;
  streakStart: string;
  streakEnd: string;
  streakLength: number;
  threshold: number;
}

/**
 * Records one alert per streak.
 *
 * The unique key makes the daily scan idempotent: a longer run of the same streak updates the end
 * date and length, and `notified_at` is left untouched so the notification fires exactly once.
 */
export async function upsertAbsenceAlert(
  tenant: string,
  input: UpsertAbsenceAlertInput,
): Promise<{ id: string; status: string; notifiedAt: Date | null; created: boolean }> {
  const subdomain = tenant.trim().toLowerCase();
  const now = new Date();
  return withTenant(subdomain, async (tx) => {
    const inserted = await tx
      .insert(attendanceAbsenceAlerts)
      .values({
        id: randomUUID(),
        workspaceSubdomain: subdomain,
        classId: input.classId,
        studentId: input.studentId,
        streakStart: input.streakStart,
        streakEnd: input.streakEnd,
        streakLength: input.streakLength,
        threshold: input.threshold,
        status: "open",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({
        target: [
          attendanceAbsenceAlerts.workspaceSubdomain,
          attendanceAbsenceAlerts.classId,
          attendanceAbsenceAlerts.studentId,
          attendanceAbsenceAlerts.streakStart,
        ],
      })
      .returning({
        id: attendanceAbsenceAlerts.id,
        status: attendanceAbsenceAlerts.status,
        notifiedAt: attendanceAbsenceAlerts.notifiedAt,
      });

    const created = inserted[0];
    if (created) {
      return {
        id: String(created.id),
        status: String(created.status),
        notifiedAt: null,
        created: true,
      };
    }

    const [updated] = await tx
      .update(attendanceAbsenceAlerts)
      .set({
        streakEnd: input.streakEnd,
        streakLength: input.streakLength,
        threshold: input.threshold,
        updatedAt: now,
      })
      .where(
        and(
          eq(attendanceAbsenceAlerts.workspaceSubdomain, subdomain),
          eq(attendanceAbsenceAlerts.classId, input.classId),
          eq(attendanceAbsenceAlerts.studentId, input.studentId),
          eq(attendanceAbsenceAlerts.streakStart, input.streakStart),
        ),
      )
      .returning({
        id: attendanceAbsenceAlerts.id,
        status: attendanceAbsenceAlerts.status,
        notifiedAt: attendanceAbsenceAlerts.notifiedAt,
      });

    return {
      id: String(updated?.id ?? ""),
      status: String(updated?.status ?? "open"),
      notifiedAt: updated?.notifiedAt ?? null,
      created: false,
    };
  });
}

/** Stamps the notification so a later scan cannot alert twice for the same streak. */
export async function markAbsenceAlertNotified(tenant: string, id: string): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, (tx) =>
    tx
      .update(attendanceAbsenceAlerts)
      .set({ notifiedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(attendanceAbsenceAlerts.workspaceSubdomain, subdomain),
          eq(attendanceAbsenceAlerts.id, id),
        ),
      ),
  );
}

export async function listAbsenceAlerts(
  tenant: string,
  options: { status?: string; studentId?: string; classId?: string; limit?: number } = {},
): Promise<AbsenceAlertRow[]> {
  const subdomain = tenant.trim().toLowerCase();
  const limit = Math.min(Math.max(options.limit ?? 200, 1), 500);
  return withTenantRead(subdomain, async (tx) => {
    const conditions = [eq(attendanceAbsenceAlerts.workspaceSubdomain, subdomain)];
    if (options.status) conditions.push(eq(attendanceAbsenceAlerts.status, options.status));
    if (options.studentId)
      conditions.push(eq(attendanceAbsenceAlerts.studentId, options.studentId));
    if (options.classId) conditions.push(eq(attendanceAbsenceAlerts.classId, options.classId));
    const rows = await tx
      .select({
        id: attendanceAbsenceAlerts.id,
        classId: attendanceAbsenceAlerts.classId,
        studentId: attendanceAbsenceAlerts.studentId,
        streakStart: attendanceAbsenceAlerts.streakStart,
        streakEnd: attendanceAbsenceAlerts.streakEnd,
        streakLength: attendanceAbsenceAlerts.streakLength,
        threshold: attendanceAbsenceAlerts.threshold,
        status: attendanceAbsenceAlerts.status,
        notifiedAt: attendanceAbsenceAlerts.notifiedAt,
        resolvedAt: attendanceAbsenceAlerts.resolvedAt,
        resolvedBy: attendanceAbsenceAlerts.resolvedBy,
        resolutionNote: attendanceAbsenceAlerts.resolutionNote,
      })
      .from(attendanceAbsenceAlerts)
      .where(and(...conditions))
      .orderBy(desc(attendanceAbsenceAlerts.streakEnd), attendanceAbsenceAlerts.id)
      .limit(limit);
    return rows.map((row) => ({
      id: String(row.id),
      classId: String(row.classId),
      studentId: String(row.studentId),
      streakStart: String(row.streakStart),
      streakEnd: String(row.streakEnd),
      streakLength: Number(row.streakLength),
      threshold: Number(row.threshold),
      status: String(row.status),
      notifiedAt: row.notifiedAt ?? null,
      resolvedAt: row.resolvedAt ?? null,
      resolvedBy: row.resolvedBy ?? null,
      resolutionNote: row.resolutionNote ?? null,
    }));
  });
}

export async function resolveAbsenceAlert(
  tenant: string,
  input: { id: string; status: "resolved" | "dismissed"; resolvedBy: string; note?: string | null },
): Promise<AbsenceAlertRow | null> {
  const subdomain = tenant.trim().toLowerCase();
  const now = new Date();
  return withTenant(subdomain, async (tx) => {
    const [row] = await tx
      .update(attendanceAbsenceAlerts)
      .set({
        status: input.status,
        resolvedBy: input.resolvedBy,
        resolvedAt: now,
        resolutionNote: input.note?.trim() ? input.note.trim() : null,
        updatedAt: now,
      })
      .where(
        and(
          eq(attendanceAbsenceAlerts.workspaceSubdomain, subdomain),
          eq(attendanceAbsenceAlerts.id, input.id),
          inArray(attendanceAbsenceAlerts.status, ["open"]),
        ),
      )
      .returning();
    if (!row) return null;
    return {
      id: String(row.id),
      classId: String(row.classId),
      studentId: String(row.studentId),
      streakStart: String(row.streakStart),
      streakEnd: String(row.streakEnd),
      streakLength: Number(row.streakLength),
      threshold: Number(row.threshold),
      status: String(row.status),
      notifiedAt: row.notifiedAt ?? null,
      resolvedAt: row.resolvedAt ?? null,
      resolvedBy: row.resolvedBy ?? null,
      resolutionNote: row.resolutionNote ?? null,
    };
  });
}
