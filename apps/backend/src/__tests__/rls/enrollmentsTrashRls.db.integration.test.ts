import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray, sql } from "drizzle-orm";
import { beginLongLivedTenantTransaction, closeDatabase } from "../../db/dbConnection.js";
import { withGlobalTenant, withTenant } from "../../db/tenant-context.js";
import {
  enrollments,
  sessionClassSections,
  sessionClasses,
  sessions,
  students,
  workspaces,
} from "../../db/schema.js";
import { listEnrollmentsPage } from "../../db/repositories/enrollmentRepositoryList.js";
import { findEnrollmentById } from "../../db/repositories/enrollmentRepositoryHydrate.js";
import {
  bulkRestoreEnrollments,
  bulkSoftDeleteEnrollments,
} from "../../db/repositories/enrollmentRepositoryPersist.js";
import { bulkSoftDeleteStudentsSql } from "../../db/repositories/studentRepositorySoftDelete.js";
import { softDeleteSessionWithCascade } from "../../db/repositories/sessionRepositoryCascade.js";
import { requireDatabaseConnection } from "../db-integration/dbTestSupport.js";

/**
 * The enrollment trash is the part of the soft-delete lifecycle that lives behind FORCE
 * RLS: `tenant_soft_delete_isolation` hides archived rows unless the transaction sets
 * `app.include_deleted`. This suite runs as a NOSUPERUSER NOBYPASSRLS role (the CI
 * `test-backend-rls` job) so it can prove the opt-in actually reaches the database —
 * the mocked route tests cannot.
 */
const TENANT_A = "x-enr-rls-a";
const TENANT_B = "x-enr-rls-b";
const SESSION = "ses-enr-rls";
const CLASS = "cls-enr-rls";
const SECTION = "sec-enr-rls";

/** Reads one enrollment including its trashed state (FORCE RLS needs the opt-in). */
async function readEnrollmentRow(id: string) {
  return withTenant(TENANT_A, async (tx) => {
    await tx.execute(sql`SELECT set_config('app.include_deleted', 'true', true)`);
    const [row] = await tx
      .select({ id: enrollments.id, deletedAt: enrollments.deletedAt })
      .from(enrollments)
      .where(and(eq(enrollments.workspaceSubdomain, TENANT_A), eq(enrollments.id, id)));
    return row;
  });
}

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

async function cleanup(): Promise<void> {
  const tx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
  try {
    await tx.tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    const tenants = [TENANT_A, TENANT_B];
    await tx.tx.delete(enrollments).where(inArray(enrollments.workspaceSubdomain, tenants));
    await tx.tx
      .delete(sessionClassSections)
      .where(inArray(sessionClassSections.workspaceSubdomain, tenants));
    await tx.tx.delete(sessionClasses).where(inArray(sessionClasses.workspaceSubdomain, tenants));
    await tx.tx.delete(sessions).where(inArray(sessions.workspaceSubdomain, tenants));
    await tx.tx.delete(students).where(inArray(students.workspaceSubdomain, tenants));
    await tx.tx.delete(workspaces).where(inArray(workspaces.subdomain, tenants));
    await tx.commit();
  } catch (error) {
    await tx.rollback().catch(() => undefined);
    throw error;
  }
}

describe("enrollments trash under FORCE RLS", () => {
  beforeAll(async () => {
    await requireDatabaseConnection();
    await assertNonBypassRole();
    await cleanup();

    await withGlobalTenant(async (tx) => {
      await tx.insert(workspaces).values([
        { id: "ws-enr-rls-a", subdomain: TENANT_A, madrasaName: "Enr RLS A", enabled: true },
        { id: "ws-enr-rls-b", subdomain: TENANT_B, madrasaName: "Enr RLS B", enabled: true },
      ]);
      await tx.insert(students).values([
        {
          id: "stu-enr-rls",
          workspaceSubdomain: TENANT_A,
          grNumber: "gr-enr-rls",
          status: "active",
        },
        {
          id: "stu-enr-rls-archived",
          workspaceSubdomain: TENANT_A,
          grNumber: "gr-enr-rls-archived",
          status: "active",
        },
      ]);
      await tx.insert(sessions).values({
        id: SESSION,
        workspaceSubdomain: TENANT_A,
        name: "Enrollment RLS Session",
      });
      await tx.insert(sessionClasses).values({
        id: CLASS,
        workspaceSubdomain: TENANT_A,
        sessionId: SESSION,
        name: "Class",
      });
      await tx.insert(sessionClassSections).values({
        id: SECTION,
        workspaceSubdomain: TENANT_A,
        sessionId: SESSION,
        classId: CLASS,
        name: "A",
        capacity: 10,
      });
      await tx.insert(enrollments).values([
        {
          id: "enr-live-a",
          workspaceSubdomain: TENANT_A,
          studentId: "stu-enr-rls",
          studentName: "Student",
          sessionId: SESSION,
          sessionName: "Enrollment RLS Session",
          classId: CLASS,
          className: "Class",
          sectionId: SECTION,
          enrolledDate: "2026-01-01",
          status: "confirmed",
        },
        {
          id: "enr-trash-a",
          workspaceSubdomain: TENANT_A,
          studentId: "stu-enr-rls-archived",
          studentName: "Student",
          sessionId: SESSION,
          sessionName: "Enrollment RLS Session",
          classId: CLASS,
          className: "Class",
          sectionId: SECTION,
          enrolledDate: "2026-01-01",
          status: "withdrawn",
          deletedAt: new Date("2026-03-01T00:00:00Z"),
          deletedBy: "u-rls",
          deletionReason: "test trash",
          deletedWithCascade: false,
        },
      ]);
    });
  });

  afterAll(async () => {
    await cleanup();
    await closeDatabase();
  });

  it("hides the archived row from the active list", async () => {
    const page = await listEnrollmentsPage(TENANT_A, { page: 1, limit: 50 });
    expect(page.enrollments.map((row) => row.id)).toContain("enr-live-a");
    expect(page.enrollments.map((row) => row.id)).not.toContain("enr-trash-a");
  });

  it("returns the archived row in the trash view", async () => {
    const page = await listEnrollmentsPage(TENANT_A, {
      page: 1,
      limit: 50,
      includeDeleted: true,
    });
    expect(page.enrollments.map((row) => row.id)).toEqual(["enr-trash-a"]);
  });

  it("reads an archived enrollment only when the read opts in", async () => {
    await expect(findEnrollmentById(TENANT_A, "enr-trash-a")).resolves.toBeNull();
    const archived = await findEnrollmentById(TENANT_A, "enr-trash-a", { includeDeleted: true });
    expect(archived?.id).toBe("enr-trash-a");
  });

  it("restores the archived enrollment and makes it visible again", async () => {
    await expect(bulkRestoreEnrollments(TENANT_A, ["enr-trash-a"], "u-rls")).resolves.toEqual({
      succeeded: 1,
      failed: 0,
    });
    const restored = await findEnrollmentById(TENANT_A, "enr-trash-a");
    expect(restored?.deletedAt ?? null).toBeNull();
  });

  it("soft-deletes an enrollment under the non-bypass role", async () => {
    // `deleted_at` is part of the RLS policy's USING expression and PostgreSQL re-checks
    // the updated row, so this only works because the write path opts into
    // `app.include_deleted`. Without that opt-in it is rejected as an RLS violation.
    await expect(
      bulkSoftDeleteEnrollments(TENANT_A, ["enr-live-a"], "u-rls", "test"),
    ).resolves.toEqual({ succeeded: 1, failed: 0 });
    expect((await readEnrollmentRow("enr-live-a"))?.deletedAt).not.toBeNull();
  });

  it("does not restore another tenant's enrollment", async () => {
    await expect(bulkRestoreEnrollments(TENANT_B, ["enr-live-a"], "u-rls")).resolves.toEqual({
      succeeded: 0,
      failed: 1,
    });
  });

  it("archives a student's enrollments with it under the non-bypass role", async () => {
    await expect(
      bulkSoftDeleteStudentsSql(TENANT_A, ["stu-enr-rls-archived"], "u-rls", "left"),
    ).resolves.toEqual({ succeeded: 1, failed: 0 });
    expect((await readEnrollmentRow("enr-trash-a"))?.deletedAt).not.toBeNull();
  });

  it("archives a session with its enrollments under the non-bypass role", async () => {
    await expect(softDeleteSessionWithCascade(TENANT_A, SESSION, "u-rls", "test")).resolves.toBe(
      true,
    );
  });
});
