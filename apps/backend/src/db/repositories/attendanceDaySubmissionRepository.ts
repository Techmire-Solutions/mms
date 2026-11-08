import { and, eq, inArray, sql } from "drizzle-orm";
import { attendanceDaySubmissions } from "../schema.js";
import { withTenant, withTenantRead } from "../tenant-context.js";
import { isAttendanceDayLocked } from "../schema/attendance.js";

/**
 * Attendance day submission state — the storage the `lockAfterSubmit` rule needs.
 *
 * A day is identified by `(workspace, class, date)`. Submitting records who/when and locks the day;
 * reopening records who/when/why and unlocks it. The newest of `submitted_at` / `reopened_at` wins,
 * so the history is append-only in practice without a second table.
 */

export interface AttendanceDaySubmissionRow {
  classId: string;
  date: string;
  submittedAt: Date;
  submittedBy: string | null;
  reopenedAt: Date | null;
  reopenedBy: string | null;
  reopenReason: string | null;
  locked: boolean;
}

function toRow(row: {
  classId: string;
  date: string;
  submittedAt: Date;
  submittedBy: string | null;
  reopenedAt: Date | null;
  reopenedBy: string | null;
  reopenReason: string | null;
}): AttendanceDaySubmissionRow {
  return { ...row, locked: isAttendanceDayLocked(row) };
}

/** Class ids, out of the (classId, date) pairs given, whose day is currently locked. */
export async function listLockedAttendanceDayKeys(
  tenant: string,
  pairs: ReadonlyArray<{ classId: string; date: string }>,
): Promise<Set<string>> {
  const subdomain = tenant.trim().toLowerCase();
  const unique = [
    ...new Map(
      pairs
        .filter((pair) => pair.classId && pair.date)
        .map((pair) => [`${pair.classId}|${pair.date}`, pair]),
    ).values(),
  ];
  if (unique.length === 0) return new Set();

  const rows = await withTenantRead(subdomain, (tx) =>
    tx
      .select({
        classId: attendanceDaySubmissions.classId,
        date: attendanceDaySubmissions.date,
        submittedAt: attendanceDaySubmissions.submittedAt,
        reopenedAt: attendanceDaySubmissions.reopenedAt,
      })
      .from(attendanceDaySubmissions)
      .where(
        and(
          eq(attendanceDaySubmissions.workspaceSubdomain, subdomain),
          inArray(attendanceDaySubmissions.classId, [...new Set(unique.map((p) => p.classId))]),
          inArray(attendanceDaySubmissions.date, [...new Set(unique.map((p) => p.date))]),
        ),
      ),
  );

  return new Set(
    rows.filter((row) => isAttendanceDayLocked(row)).map((row) => `${row.classId}|${row.date}`),
  );
}

export async function getAttendanceDaySubmission(
  tenant: string,
  classId: string,
  date: string,
): Promise<AttendanceDaySubmissionRow | null> {
  const subdomain = tenant.trim().toLowerCase();
  const [row] = await withTenantRead(subdomain, (tx) =>
    tx
      .select()
      .from(attendanceDaySubmissions)
      .where(
        and(
          eq(attendanceDaySubmissions.workspaceSubdomain, subdomain),
          eq(attendanceDaySubmissions.classId, classId),
          eq(attendanceDaySubmissions.date, date),
        ),
      )
      .limit(1),
  );
  return row ? toRow(row) : null;
}

/** Submits (or re-submits) a day, clearing any earlier reopen. Returns the stored state. */
export async function upsertAttendanceDaySubmission(
  tenant: string,
  input: { classId: string; date: string; submittedBy?: string | null; at?: Date },
): Promise<AttendanceDaySubmissionRow> {
  const subdomain = tenant.trim().toLowerCase();
  const at = input.at ?? new Date();
  const [row] = await withTenant(subdomain, async (tx) => {
    return tx
      .insert(attendanceDaySubmissions)
      .values({
        workspaceSubdomain: subdomain,
        classId: input.classId,
        date: input.date,
        submittedAt: at,
        submittedBy: input.submittedBy ?? null,
        reopenedAt: null,
        reopenedBy: null,
        reopenReason: null,
        updatedAt: at,
      })
      .onConflictDoUpdate({
        target: [
          attendanceDaySubmissions.workspaceSubdomain,
          attendanceDaySubmissions.classId,
          attendanceDaySubmissions.date,
        ],
        set: {
          submittedAt: at,
          submittedBy: input.submittedBy ?? null,
          reopenedAt: null,
          reopenedBy: null,
          reopenReason: null,
          updatedAt: at,
        },
      })
      .returning();
  });
  return toRow(row!);
}

/** Reopens a submitted day. Returns null when the day was never submitted. */
export async function reopenAttendanceDay(
  tenant: string,
  input: {
    classId: string;
    date: string;
    reopenedBy?: string | null;
    reason?: string | null;
    at?: Date;
  },
): Promise<AttendanceDaySubmissionRow | null> {
  const subdomain = tenant.trim().toLowerCase();
  const at = input.at ?? new Date();
  const [row] = await withTenant(subdomain, async (tx) =>
    tx
      .update(attendanceDaySubmissions)
      .set({
        reopenedAt: at,
        reopenedBy: input.reopenedBy ?? null,
        reopenReason: input.reason?.trim() ? input.reason.trim() : null,
        updatedAt: at,
      })
      .where(
        and(
          eq(attendanceDaySubmissions.workspaceSubdomain, subdomain),
          eq(attendanceDaySubmissions.classId, input.classId),
          eq(attendanceDaySubmissions.date, input.date),
        ),
      )
      .returning(),
  );
  return row ? toRow(row) : null;
}

/** Test/seed helper: count of submitted days for a workspace. */
export async function countAttendanceDaySubmissions(tenant: string): Promise<number> {
  const subdomain = tenant.trim().toLowerCase();
  const [row] = await withTenantRead(subdomain, (tx) =>
    tx
      .select({ count: sql<number>`count(*)::int` })
      .from(attendanceDaySubmissions)
      .where(eq(attendanceDaySubmissions.workspaceSubdomain, subdomain)),
  );
  return Number(row?.count ?? 0);
}
