import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, sql } from "drizzle-orm";
import { closeDatabase, beginLongLivedTenantTransaction } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import { attendance, sessionClasses, sessions, students, workspaces } from "../../db/schema.js";
import { ATTENDANCE_RECORD_STATUSES } from "@mms/shared";
import { requireDatabaseConnection } from "./dbTestSupport.js";

/**
 * DB parity for the attendance status domain.
 *
 * The shared enum is the contract; this asserts the Postgres CHECK enforces exactly it — including
 * `half_day` — so a migration that forgets a new value fails here instead of at the first mark.
 */

const TENANT = "att-status-parity";

async function purge(): Promise<void> {
  const tx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
  try {
    await tx.tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.tx.delete(attendance).where(eq(attendance.workspaceSubdomain, TENANT));
    await tx.tx.delete(sessionClasses).where(eq(sessionClasses.workspaceSubdomain, TENANT));
    await tx.tx.delete(sessions).where(eq(sessions.workspaceSubdomain, TENANT));
    await tx.tx.delete(students).where(eq(students.workspaceSubdomain, TENANT));
    await tx.tx.delete(workspaces).where(eq(workspaces.subdomain, TENANT));
    await tx.commit();
  } catch (error) {
    await tx.rollback().catch(() => undefined);
    throw error;
  }
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await purge();
  await withTenant(
    TENANT,
    async (tx) => {
      await tx
        .insert(workspaces)
        .values({ id: `ws-${TENANT}`, subdomain: TENANT, madrasaName: "Status parity" })
        .onConflictDoNothing();
      await tx
        .insert(students)
        .values([
          { id: "std-1", workspaceSubdomain: TENANT, grNumber: "gr-parity-1", status: "active" },
        ]);
      await tx.insert(sessions).values({
        id: "ses-1",
        workspaceSubdomain: TENANT,
        name: "Parity Session",
        minAttendancePct: 75,
      });
      await tx
        .insert(sessionClasses)
        .values([
          { id: "cls-1", workspaceSubdomain: TENANT, sessionId: "ses-1", name: "Parity Class" },
        ]);
    },
    { readOnly: false },
  );
}, 120_000);

afterAll(async () => {
  await purge();
  await closeDatabase();
});

function mark(status: string, suffix: string, day = 2) {
  return {
    id: `att-${suffix}`,
    workspaceSubdomain: TENANT,
    classId: "cls-1",
    studentId: "std-1",
    studentName: "Student",
    rollNo: "1",
    date: `2026-03-${String(day).padStart(2, "0")}`,
    status,
    timeIn: "",
    timeOut: "",
    notes: "",
  };
}

describe("attendance_status_check parity", () => {
  it("accepts every status in the shared enum, including half_day", async () => {
    for (const [index, status] of ATTENDANCE_RECORD_STATUSES.entries()) {
      const inserted = await withTenant(
        TENANT,
        (tx) =>
          tx
            .insert(attendance)
            .values(mark(status, String(index), index + 2))
            .returning({ id: attendance.id }),
        { readOnly: false },
      );
      expect(inserted, `status ${status} was rejected`).toHaveLength(1);
    }
  });

  it("rejects a status outside the shared enum", async () => {
    let captured: unknown;
    try {
      await withTenant(TENANT, (tx) => tx.insert(attendance).values(mark("holiday", "bogus", 20)), {
        readOnly: false,
      });
    } catch (error) {
      captured = error;
    }
    expect(captured).toBeDefined();
    const details =
      captured instanceof Error
        ? `${captured.message} ${String((captured as { cause?: { message?: string; constraint?: string } }).cause?.message ?? "")} ${(captured as { cause?: { constraint?: string } }).cause?.constraint ?? ""}`
        : String(captured);
    expect(details).toContain("attendance_status_check");
  });

  it("declares the constraint with exactly the shared values", async () => {
    const tx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    try {
      const rows = await tx.tx.execute<{ def: string }>(sql`
        SELECT pg_get_constraintdef(oid) AS def
          FROM pg_constraint
         WHERE conrelid = 'attendance'::regclass AND conname = 'attendance_status_check'
      `);
      const def = String(rows.rows?.[0]?.def ?? "");
      for (const status of ATTENDANCE_RECORD_STATUSES) {
        expect(def, `${status} missing from the CHECK`).toContain(`'${status}'`);
      }
    } finally {
      await tx.commit();
    }
  });

  it("counts half_day as attended in the report overview", async () => {
    // The five accepted rows above are present/absent/late/half_day/excused in enum order.
    const { loadCountableAttendanceSql } =
      await import("../../db/repositories/attendanceCountableSql.js");
    const countable = await loadCountableAttendanceSql(TENANT);
    const { loadAttendanceOverview } =
      await import("../../db/repositories/attendanceReportOverview.js");
    const overview = await withTenant(
      TENANT,
      (tx) => loadAttendanceOverview(tx, TENANT, countable, undefined, 75),
      { readOnly: false },
    );
    const attended = overview.statusCounts
      .filter((row) => ["present", "late", "half_day"].includes(row.status))
      .reduce((sum, row) => sum + row.count, 0);
    expect(attended).toBe(3);
  });
});
