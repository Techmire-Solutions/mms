import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  initializeDatabaseConnection,
  pingDatabase,
  closeDatabase,
  beginLongLivedTenantTransaction,
} from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { workspaces, students, sessions, sessionClasses, enrollments } from "../../db/schema.js";
import {
  cascadeSoftDeleteEnrollmentsForStudents,
  restoreCascadedEnrollmentsForStudents,
} from "../../db/repositories/studentEnrollmentCascade.js";

const TEST_SUBDOMAIN = "stu-cascade-test";
const STUDENT_ID = "stu-cascade-1";
const SESSION_ID = "ses-cascade-1";
const CLASS_ID = "cls-cascade-1";
const ENROLLMENT_ID = "enr-cascade-1";
const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function applyDatabaseUrlFromEnvFile(): void {
  if (process.env.DATABASE_URL) return;
  try {
    const content = readFileSync(join(backendRoot, ".env"), "utf-8");
    const match = content.match(/^DATABASE_URL\s*=\s*"?([^"\n]+)"?$/m);
    if (match) process.env.DATABASE_URL = match[1].trim();
  } catch {
    // fallback to environment defaults
  }
}

let dbAvailable = false;

beforeAll(async () => {
  applyDatabaseUrlFromEnvFile();
  initializeDatabaseConnection();
  dbAvailable = await pingDatabase();
  if (!dbAvailable) return;

  await applyDrizzleMigrations();

  const seedTx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
  try {
    await seedTx.tx.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mms_test_tenant_role') THEN
          CREATE ROLE mms_test_tenant_role NOSUPERUSER NOBYPASSRLS;
        END IF;
      END $$;
      GRANT USAGE ON SCHEMA public TO mms_test_tenant_role;
      GRANT ALL ON ALL TABLES IN SCHEMA public TO mms_test_tenant_role;
      DROP POLICY IF EXISTS "enrollments_tenant_isolation" ON "enrollments";
    `);
    await seedTx.tx
      .insert(workspaces)
      .values({
        id: "ws-stu-cascade-test",
        subdomain: TEST_SUBDOMAIN,
        madrasaName: "Student Cascade Test Workspace",
        enabled: true,
      })
      .onConflictDoNothing();
    await seedTx.commit();
  } catch (error) {
    await seedTx.rollback().catch(() => undefined);
    throw error;
  }
});

afterAll(async () => {
  if (dbAvailable) {
    const cleanupTx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    try {
      await cleanupTx.tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
      await cleanupTx.tx
        .delete(enrollments)
        .where(eq(enrollments.workspaceSubdomain, TEST_SUBDOMAIN));
      await cleanupTx.tx
        .delete(sessionClasses)
        .where(eq(sessionClasses.workspaceSubdomain, TEST_SUBDOMAIN));
      await cleanupTx.tx.delete(sessions).where(eq(sessions.workspaceSubdomain, TEST_SUBDOMAIN));
      await cleanupTx.tx.delete(students).where(eq(students.workspaceSubdomain, TEST_SUBDOMAIN));
      await cleanupTx.tx.delete(workspaces).where(eq(workspaces.subdomain, TEST_SUBDOMAIN));
      await cleanupTx.commit();
    } catch {
      await cleanupTx.rollback().catch(() => undefined);
    }
  }
  await closeDatabase();
});

describe("student soft-delete enrollment cascade (real Postgres)", () => {
  it("cascades soft-delete to enrollments and restores only cascade-deleted rows", async (ctx) => {
    if (!dbAvailable) {
      ctx.skip();
      return;
    }

    const setupTx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    try {
      await setupTx.tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
      await setupTx.tx
        .delete(enrollments)
        .where(eq(enrollments.workspaceSubdomain, TEST_SUBDOMAIN));
      await setupTx.tx
        .delete(sessionClasses)
        .where(eq(sessionClasses.workspaceSubdomain, TEST_SUBDOMAIN));
      await setupTx.tx.delete(sessions).where(eq(sessions.workspaceSubdomain, TEST_SUBDOMAIN));
      await setupTx.tx.delete(students).where(eq(students.workspaceSubdomain, TEST_SUBDOMAIN));

      await setupTx.tx.insert(students).values({
        id: STUDENT_ID,
        workspaceSubdomain: TEST_SUBDOMAIN,
        grNumber: "gr-cascade-001",
        status: "active",
      });
      await setupTx.tx.insert(sessions).values({
        id: SESSION_ID,
        workspaceSubdomain: TEST_SUBDOMAIN,
        name: "Cascade Session",
      });
      await setupTx.tx.insert(sessionClasses).values({
        id: CLASS_ID,
        workspaceSubdomain: TEST_SUBDOMAIN,
        sessionId: SESSION_ID,
        name: "Cascade Class",
      });
      await setupTx.tx.insert(enrollments).values({
        id: ENROLLMENT_ID,
        workspaceSubdomain: TEST_SUBDOMAIN,
        studentId: STUDENT_ID,
        studentName: "Cascade Student",
        sessionId: SESSION_ID,
        sessionName: "Cascade Session",
        classId: CLASS_ID,
        className: "Cascade Class",
        enrolledDate: "2026-01-01",
      });
      await setupTx.commit();
    } catch (error) {
      await setupTx.rollback().catch(() => undefined);
      throw error;
    }

    const deletedAt = new Date("2026-03-01T12:00:00.000Z");
    const cascadeTx = await beginLongLivedTenantTransaction(TEST_SUBDOMAIN);
    try {
      await cascadeTx.tx
        .update(students)
        .set({
          deletedAt,
          deletedBy: "u-admin",
          deletionReason: "Left country",
        })
        .where(and(eq(students.workspaceSubdomain, TEST_SUBDOMAIN), eq(students.id, STUDENT_ID)));

      await cascadeSoftDeleteEnrollmentsForStudents(
        cascadeTx.tx,
        TEST_SUBDOMAIN,
        [STUDENT_ID],
        "u-admin",
        "Left country",
        deletedAt,
      );
      await cascadeTx.commit();
    } catch (error) {
      await cascadeTx.rollback().catch(() => undefined);
      throw error;
    }

    const rlsTx = await beginLongLivedTenantTransaction(TEST_SUBDOMAIN);
    try {
      await rlsTx.tx.execute(sql`SET LOCAL ROLE mms_test_tenant_role`);
      await rlsTx.tx.execute(sql`SELECT
        set_config('app.current_tenant', ${TEST_SUBDOMAIN}, true),
        set_config('app.rls_bypass', 'off', true)
      `);

      // Without include_deleted GUC, FORCE RLS hides soft-deleted enrollments.
      const hidden = await rlsTx.tx
        .select({ id: enrollments.id })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.workspaceSubdomain, TEST_SUBDOMAIN),
            eq(enrollments.id, ENROLLMENT_ID),
          ),
        );
      expect(hidden).toHaveLength(0);

      await rlsTx.tx.execute(sql`SELECT set_config('app.include_deleted', 'true', true)`);
      const cascaded = await rlsTx.tx
        .select({
          id: enrollments.id,
          deletedAt: enrollments.deletedAt,
          deletedWithCascade: enrollments.deletedWithCascade,
          deletionReason: enrollments.deletionReason,
        })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.workspaceSubdomain, TEST_SUBDOMAIN),
            eq(enrollments.id, ENROLLMENT_ID),
          ),
        );
      expect(cascaded).toHaveLength(1);
      expect(cascaded[0]?.deletedAt).toBeTruthy();
      expect(cascaded[0]?.deletedWithCascade).toBe(true);
      expect(cascaded[0]?.deletionReason).toMatch(/Cascade: parent student deleted/);
      await rlsTx.commit();
    } catch (error) {
      await rlsTx.rollback().catch(() => undefined);
      throw error;
    }

    const restoreTx = await beginLongLivedTenantTransaction(TEST_SUBDOMAIN);
    try {
      await restoreTx.tx.execute(sql`SELECT set_config('app.include_deleted', 'true', true)`);
      const restoredAt = new Date("2026-03-02T12:00:00.000Z");
      await restoreTx.tx
        .update(students)
        .set({
          deletedAt: null,
          deletedBy: null,
          deletionReason: null,
          restoredAt,
          restoredBy: "u-admin",
        })
        .where(and(eq(students.workspaceSubdomain, TEST_SUBDOMAIN), eq(students.id, STUDENT_ID)));

      await restoreCascadedEnrollmentsForStudents(
        restoreTx.tx,
        TEST_SUBDOMAIN,
        [STUDENT_ID],
        "u-admin",
        restoredAt,
      );

      const restored = await restoreTx.tx
        .select({
          id: enrollments.id,
          deletedAt: enrollments.deletedAt,
          deletedWithCascade: enrollments.deletedWithCascade,
        })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.workspaceSubdomain, TEST_SUBDOMAIN),
            eq(enrollments.id, ENROLLMENT_ID),
          ),
        );
      expect(restored).toHaveLength(1);
      expect(restored[0]?.deletedAt).toBeNull();
      expect(restored[0]?.deletedWithCascade).toBe(false);

      await restoreTx.commit();
    } catch (error) {
      await restoreTx.rollback().catch(() => undefined);
      throw error;
    }
  });
});
