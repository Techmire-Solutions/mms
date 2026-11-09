import pg from "pg";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { closeDatabase, beginLongLivedTenantTransaction } from "../../db/dbConnection.js";
import { withTenant, withTenantRead } from "../../db/tenant-context.js";
import {
  attendance,
  attendanceAbsenceAlerts,
  attendanceDaySubmissions,
  attendanceLeaves,
  enrollments,
  sessionClassSections,
  sessionClasses,
  sessions,
  students,
  workspaces,
} from "../../db/schema.js";
import { requireDatabaseConnection } from "../db-integration/dbTestSupport.js";

/**
 * Tenant isolation for the attendance tables.
 *
 * Defence in depth: the repositories all filter `workspace_subdomain`, and FORCE RLS backs that up at
 * the database. This suite runs as a NOSUPERUSER NOBYPASSRLS role (the CI `test-backend-rls` job) so
 * it can prove tenant isolation is enforced by the database itself even when a query carries no WHERE
 * clause — running this under `postgres` (superuser / bypass RLS) would prove nothing.
 */

const TENANT_A = "att-iso-a";
const TENANT_B = "att-iso-b";
const CLASS_A = "cls-iso-a";
const CLASS_B = "cls-iso-b";
const STUDENT_A = "stu-iso-a";
const STUDENT_B = "stu-iso-b";

async function assertNonBypassRole(): Promise<void> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query<{
      role: string;
      is_superuser: boolean;
      bypass_rls: boolean;
    }>(
      `SELECT current_user AS role, r.rolsuper AS is_superuser, r.rolbypassrls AS bypass_rls
         FROM pg_roles r WHERE r.rolname = current_user`,
    );
    const row = result.rows[0];
    if (!row || row.is_superuser || row.bypass_rls) {
      throw new Error(
        `RLS suite must run as a NOSUPERUSER NOBYPASSRLS role; connected as ${row?.role ?? "unknown"}.`,
      );
    }
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function purge(): Promise<void> {
  const tx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
  try {
    await tx.tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    for (const tenant of [TENANT_A, TENANT_B]) {
      await tx.tx.delete(attendance).where(eq(attendance.workspaceSubdomain, tenant));
      await tx.tx.delete(attendanceLeaves).where(eq(attendanceLeaves.workspaceSubdomain, tenant));
      await tx.tx
        .delete(attendanceAbsenceAlerts)
        .where(eq(attendanceAbsenceAlerts.workspaceSubdomain, tenant));
      await tx.tx
        .delete(attendanceDaySubmissions)
        .where(eq(attendanceDaySubmissions.workspaceSubdomain, tenant));
      await tx.tx.delete(enrollments).where(eq(enrollments.workspaceSubdomain, tenant));
      await tx.tx
        .delete(sessionClassSections)
        .where(eq(sessionClassSections.workspaceSubdomain, tenant));
      await tx.tx.delete(sessionClasses).where(eq(sessionClasses.workspaceSubdomain, tenant));
      await tx.tx.delete(sessions).where(eq(sessions.workspaceSubdomain, tenant));
      await tx.tx.delete(students).where(eq(students.workspaceSubdomain, tenant));
      await tx.tx.delete(workspaces).where(eq(workspaces.subdomain, tenant));
    }
    await tx.commit();
  } catch (error) {
    await tx.rollback().catch(() => undefined);
    throw error;
  }
}

async function seedTenant(tenant: string, classId: string, studentId: string): Promise<void> {
  const sessionId = `ses-${tenant}`;
  const sectionId = `sec-${tenant}`;
  await withTenant(
    tenant,
    async (tx) => {
      await tx
        .insert(workspaces)
        .values({ id: `ws-${tenant}`, subdomain: tenant, madrasaName: `Isolation ${tenant}` })
        .onConflictDoNothing();
      await tx.insert(students).values({
        id: studentId,
        workspaceSubdomain: tenant,
        grNumber: `gr-${studentId}`,
        status: "active",
      });
      await tx
        .insert(sessions)
        .values({ id: sessionId, workspaceSubdomain: tenant, name: `Session ${tenant}` });
      await tx
        .insert(sessionClasses)
        .values({ id: classId, workspaceSubdomain: tenant, sessionId, name: `Class ${tenant}` });
      await tx.insert(sessionClassSections).values({
        id: sectionId,
        workspaceSubdomain: tenant,
        sessionId,
        classId,
        name: "A",
        capacity: 30,
      });
      await tx.insert(enrollments).values({
        id: `enr-${tenant}`,
        workspaceSubdomain: tenant,
        studentId,
        studentName: studentId,
        sessionId,
        sessionName: `Session ${tenant}`,
        classId,
        className: `Class ${tenant}`,
        sectionId,
        enrolledDate: "2026-01-01",
        startOn: "2026-01-01",
        status: "confirmed",
      });
      await tx.insert(attendance).values({
        id: `att-${tenant}`,
        workspaceSubdomain: tenant,
        classId,
        studentId,
        studentName: studentId,
        rollNo: "1",
        date: "2026-03-02",
        status: "present",
        timeIn: "07:00",
        timeOut: "08:30",
        notes: "",
      });
      await tx.insert(attendanceLeaves).values({
        id: `leave-${tenant}`,
        workspaceSubdomain: tenant,
        studentId,
        fromDate: "2026-03-03",
        toDate: "2026-03-04",
        reason: "Medical",
        status: "pending",
      });
      // Composite key (workspace, class, date) — no surrogate id.
      await tx.insert(attendanceDaySubmissions).values({
        workspaceSubdomain: tenant,
        classId,
        date: "2026-03-02",
        submittedBy: "u-admin",
      });
      await tx.insert(attendanceAbsenceAlerts).values({
        id: `alert-${tenant}`,
        workspaceSubdomain: tenant,
        classId,
        studentId,
        streakStart: "2026-03-01",
        streakEnd: "2026-03-02",
        streakLength: 2,
        threshold: 2,
        status: "open",
      });
    },
    { readOnly: false },
  );
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await assertNonBypassRole();
  await purge();
  await seedTenant(TENANT_A, CLASS_A, STUDENT_A);
  await seedTenant(TENANT_B, CLASS_B, STUDENT_B);
}, 120_000);

afterAll(async () => {
  await purge();
  await closeDatabase();
});

describe("attendance tenant isolation", () => {
  it("every attendance tenant table enforces FORCE row level security", async () => {
    const tx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    try {
      const rows = await tx.tx.execute<{ relname: string; rls: boolean; forced: boolean }>(sql`
        SELECT c.relname, c.relrowsecurity AS rls, c.relforcerowsecurity AS forced
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public'
           AND c.relname IN (
             'attendance', 'attendance_leaves', 'attendance_day_submissions',
             'attendance_absence_alerts'
           )
      `);
      const byName = new Map((rows.rows ?? []).map((row) => [row.relname, row]));
      for (const table of [
        "attendance",
        "attendance_leaves",
        "attendance_day_submissions",
        "attendance_absence_alerts",
      ]) {
        const entry = byName.get(table);
        expect(entry, `${table} missing`).toBeDefined();
        expect(entry?.rls, `${table} RLS not enabled`).toBe(true);
        expect(entry?.forced, `${table} RLS not forced`).toBe(true);
      }
    } finally {
      await tx.commit();
    }
  });

  it("reads return only the tenant's own rows", async () => {
    const [ownMarks, ownLeaves, ownSubmissions, ownAlerts] = await Promise.all([
      withTenantRead(TENANT_A, (tx) => tx.select().from(attendance)),
      withTenantRead(TENANT_A, (tx) => tx.select().from(attendanceLeaves)),
      withTenantRead(TENANT_A, (tx) => tx.select().from(attendanceDaySubmissions)),
      withTenantRead(TENANT_A, (tx) => tx.select().from(attendanceAbsenceAlerts)),
    ]);

    expect(ownMarks.map((row) => row.workspaceSubdomain)).toEqual([TENANT_A]);
    expect(ownLeaves.map((row) => row.workspaceSubdomain)).toEqual([TENANT_A]);
    expect(ownSubmissions.map((row) => row.workspaceSubdomain)).toEqual([TENANT_A]);
    expect(ownAlerts.map((row) => row.workspaceSubdomain)).toEqual([TENANT_A]);
  });

  it("cannot update or delete another tenant's mark", async () => {
    const updated = await withTenant(
      TENANT_A,
      (tx) =>
        tx
          .update(attendance)
          .set({ status: "absent" })
          .where(
            and(eq(attendance.workspaceSubdomain, TENANT_B), eq(attendance.id, `att-${TENANT_B}`)),
          )
          .returning({ id: attendance.id }),
      { readOnly: false },
    );
    expect(updated).toHaveLength(0);

    const deleted = await withTenant(
      TENANT_A,
      (tx) =>
        tx
          .delete(attendanceLeaves)
          .where(eq(attendanceLeaves.id, `leave-${TENANT_B}`))
          .returning({ id: attendanceLeaves.id }),
      { readOnly: false },
    );
    expect(deleted).toHaveLength(0);

    // B's rows are untouched.
    const stillThere = await withTenantRead(TENANT_B, (tx) =>
      tx
        .select({ status: attendance.status })
        .from(attendance)
        .where(eq(attendance.id, `att-${TENANT_B}`)),
    );
    expect(stillThere[0]?.status).toBe("present");
  });

  it("raw-SQL paths stay inside the tenant (retroactive excuse sync)", async () => {
    const { excuseAbsencesInRange } =
      await import("../../db/repositories/attendanceLeaveSyncRepository.js");
    // Mark an absence in B, then run A's sync for the same student id shape.
    await withTenant(
      TENANT_B,
      (tx) =>
        tx
          .update(attendance)
          .set({ status: "absent" })
          .where(eq(attendance.id, `att-${TENANT_B}`)),
      { readOnly: false },
    );

    const changed = await excuseAbsencesInRange(TENANT_A, {
      studentId: STUDENT_B,
      fromDate: "2026-03-01",
      toDate: "2026-03-05",
      note: "Excused by approved leave",
    });
    expect(changed).toHaveLength(0);

    const bRow = await withTenantRead(TENANT_B, (tx) =>
      tx
        .select({ status: attendance.status })
        .from(attendance)
        .where(eq(attendance.id, `att-${TENANT_B}`)),
    );
    expect(bRow[0]?.status).toBe("absent");
  });
});
