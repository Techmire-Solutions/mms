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
import { workspaces, students, tenantUsers, contacts } from "../../db/schema.js";

const TEST_SUBDOMAIN = "soft-delete-test";
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

function extractPgErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  if ("code" in error && typeof (error as { code?: unknown }).code === "string") {
    return (error as { code: string }).code;
  }
  if ("cause" in error) {
    return extractPgErrorCode((error as { cause?: unknown }).cause);
  }
  return undefined;
}

function extractPgErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const msg =
    "message" in error && typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : "";
  if ("cause" in error) {
    return `${msg} ${extractPgErrorMessage((error as { cause?: unknown }).cause)}`;
  }
  return msg;
}

let dbAvailable = false;

beforeAll(async () => {
  applyDatabaseUrlFromEnvFile();
  initializeDatabaseConnection();
  dbAvailable = await pingDatabase();
  if (!dbAvailable) return;

  // Apply DDL migrations (including 0108 triggers, partial indexes, and RLS)
  await applyDrizzleMigrations();

  const seedTx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
  try {
    // Ensure test non-superuser role exists for PostgreSQL RLS testing
    await seedTx.tx.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mms_test_tenant_role') THEN
          CREATE ROLE mms_test_tenant_role NOSUPERUSER NOBYPASSRLS;
        END IF;
      END $$;
      GRANT USAGE ON SCHEMA public TO mms_test_tenant_role;
      GRANT ALL ON ALL TABLES IN SCHEMA public TO mms_test_tenant_role;
    `);

    await seedTx.tx
      .insert(workspaces)
      .values({
        id: "ws-soft-delete-test",
        subdomain: TEST_SUBDOMAIN,
        madrasaName: "Soft Delete Test Workspace",
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
      await cleanupTx.tx.delete(students).where(eq(students.workspaceSubdomain, TEST_SUBDOMAIN));
      await cleanupTx.tx.delete(contacts).where(eq(contacts.workspaceSubdomain, TEST_SUBDOMAIN));
      await cleanupTx.tx
        .delete(tenantUsers)
        .where(eq(tenantUsers.workspaceSubdomain, TEST_SUBDOMAIN));
      await cleanupTx.tx.delete(workspaces).where(eq(workspaces.subdomain, TEST_SUBDOMAIN));
      await cleanupTx.commit();
    } catch {
      await cleanupTx.rollback().catch(() => undefined);
    }
  }
  await closeDatabase();
});

describe("MMS Soft-Delete Database Schema Foundations", () => {
  it("blocks hard physical DELETE on contacts table via BEFORE DELETE trigger", async (ctx) => {
    if (!dbAvailable) {
      ctx.skip();
      return;
    }

    const setupTx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    try {
      await setupTx.tx.insert(contacts).values({
        id: "con-trigger-block-test",
        workspaceSubdomain: TEST_SUBDOMAIN,
        firstName: "Trigger",
        name: "Trigger Block Test",
      });
      await setupTx.commit();
    } catch (error) {
      await setupTx.rollback().catch(() => undefined);
      throw error;
    }

    const deleteTx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    try {
      let rejected = false;
      try {
        await deleteTx.tx
          .delete(contacts)
          .where(
            and(
              eq(contacts.workspaceSubdomain, TEST_SUBDOMAIN),
              eq(contacts.id, "con-trigger-block-test"),
            ),
          );
      } catch (err: unknown) {
        rejected = true;
        const code = extractPgErrorCode(err);
        const msg = extractPgErrorMessage(err);
        expect(code).toBe("23514"); // check_violation
        expect(msg).toMatch(/Hard delete forbidden on table/i);
      }
      expect(rejected).toBe(true);
    } finally {
      await deleteTx.rollback().catch(() => undefined);
    }
  });
  it("blocks hard physical DELETE on soft-deletable table via BEFORE DELETE trigger", async (ctx) => {
    if (!dbAvailable) {
      ctx.skip();
      return;
    }

    const setupTx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    try {
      await setupTx.tx.insert(students).values({
        id: "stu-trigger-block-test",
        workspaceSubdomain: TEST_SUBDOMAIN,
        grNumber: "GR-TRIGGER-001",
        status: "active",
      });
      await setupTx.commit();
    } catch (error) {
      await setupTx.rollback().catch(() => undefined);
      throw error;
    }

    const deleteTx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    try {
      let rejected = false;
      try {
        await deleteTx.tx
          .delete(students)
          .where(
            and(
              eq(students.workspaceSubdomain, TEST_SUBDOMAIN),
              eq(students.id, "stu-trigger-block-test"),
            ),
          );
      } catch (err: unknown) {
        rejected = true;
        const code = extractPgErrorCode(err);
        const msg = extractPgErrorMessage(err);
        expect(code).toBe("23514"); // check_violation
        expect(msg).toMatch(/Hard delete forbidden on table/i);
      }
      expect(rejected).toBe(true);
    } finally {
      await deleteTx.rollback().catch(() => undefined);
    }
  });

  it("permits physical purge when app.allow_hard_purge is set to true", async (ctx) => {
    if (!dbAvailable) {
      ctx.skip();
      return;
    }

    const purgeTx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    try {
      await purgeTx.tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
      await purgeTx.tx
        .delete(students)
        .where(
          and(
            eq(students.workspaceSubdomain, TEST_SUBDOMAIN),
            eq(students.id, "stu-trigger-block-test"),
          ),
        );
      await purgeTx.commit();
    } catch (error) {
      await purgeTx.rollback().catch(() => undefined);
      throw error;
    }

    const verifyTx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    try {
      const remaining = await verifyTx.tx
        .select({ id: students.id })
        .from(students)
        .where(
          and(
            eq(students.workspaceSubdomain, TEST_SUBDOMAIN),
            eq(students.id, "stu-trigger-block-test"),
          ),
        );
      expect(remaining.length).toBe(0);
      await verifyTx.commit();
    } catch (error) {
      await verifyTx.rollback().catch(() => undefined);
      throw error;
    }
  });

  it("allows recycling natural unique key once previous record is soft-deleted", async (ctx) => {
    if (!dbAvailable) {
      ctx.skip();
      return;
    }

    const RECYCLE_GR = "GR-RECYCLE-999";

    // 1. Insert Student A with RECYCLE_GR
    const insTx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    try {
      await insTx.tx.insert(students).values({
        id: "stu-recycle-a",
        workspaceSubdomain: TEST_SUBDOMAIN,
        grNumber: RECYCLE_GR,
        status: "active",
      });
      await insTx.commit();
    } catch (error) {
      await insTx.rollback().catch(() => undefined);
      throw error;
    }

    // 2. Soft-delete Student A
    const softDelTx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    try {
      await softDelTx.tx
        .update(students)
        .set({
          deletedAt: new Date(),
          deletedBy: "admin-tester",
          deletionReason: "Archived for graduation",
        })
        .where(
          and(eq(students.workspaceSubdomain, TEST_SUBDOMAIN), eq(students.id, "stu-recycle-a")),
        );
      await softDelTx.commit();
    } catch (error) {
      await softDelTx.rollback().catch(() => undefined);
      throw error;
    }

    // 3. Insert Student B with same RECYCLE_GR (must succeed under partial unique index)
    const insBtx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    try {
      await insBtx.tx.insert(students).values({
        id: "stu-recycle-b",
        workspaceSubdomain: TEST_SUBDOMAIN,
        grNumber: RECYCLE_GR,
        status: "active",
      });
      await insBtx.commit();
    } catch (error) {
      await insBtx.rollback().catch(() => undefined);
      throw error;
    }

    // 4. Attempting to insert Student C with same RECYCLE_GR while B is active must throw 23505
    const insCtx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    try {
      let threwConflict = false;
      try {
        await insCtx.tx.insert(students).values({
          id: "stu-recycle-c",
          workspaceSubdomain: TEST_SUBDOMAIN,
          grNumber: RECYCLE_GR,
          status: "active",
        });
      } catch (err: unknown) {
        threwConflict = true;
        const code = extractPgErrorCode(err);
        expect(code).toBe("23505"); // unique_violation
      }
      expect(threwConflict).toBe(true);
    } finally {
      await insCtx.rollback().catch(() => undefined);
    }
  });

  it("allows recycling natural unique email once previous record is soft-deleted", async (ctx) => {
    if (!dbAvailable) {
      ctx.skip();
      return;
    }

    const RECYCLE_EMAIL = "recycle-tester@example.com";

    // 1. Insert User A with RECYCLE_EMAIL
    const insTx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    try {
      await insTx.tx.insert(tenantUsers).values({
        id: "usr-recycle-a",
        workspaceSubdomain: TEST_SUBDOMAIN,
        loginEmail: RECYCLE_EMAIL,
        passwordHash: "dummy_hash",
        name: "User A",
      });
      await insTx.commit();
    } catch (error) {
      await insTx.rollback().catch(() => undefined);
      throw error;
    }

    // 2. Soft-delete User A
    const softDelTx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    try {
      await softDelTx.tx
        .update(tenantUsers)
        .set({
          deletedAt: new Date(),
          deletedBy: "admin-tester",
          deletionReason: "Archived staff account",
        })
        .where(
          and(
            eq(tenantUsers.workspaceSubdomain, TEST_SUBDOMAIN),
            eq(tenantUsers.id, "usr-recycle-a"),
          ),
        );
      await softDelTx.commit();
    } catch (error) {
      await softDelTx.rollback().catch(() => undefined);
      throw error;
    }

    // 3. Insert User B with same RECYCLE_EMAIL (must succeed under partial unique index)
    const insBtx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    try {
      await insBtx.tx.insert(tenantUsers).values({
        id: "usr-recycle-b",
        workspaceSubdomain: TEST_SUBDOMAIN,
        loginEmail: RECYCLE_EMAIL,
        passwordHash: "dummy_hash",
        name: "User B",
      });
      await insBtx.commit();
    } catch (error) {
      await insBtx.rollback().catch(() => undefined);
      throw error;
    }

    // 4. Attempting to insert User C with same RECYCLE_EMAIL while B is active must throw 23505
    const insCtx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    try {
      let threwConflict = false;
      try {
        await insCtx.tx.insert(tenantUsers).values({
          id: "usr-recycle-c",
          workspaceSubdomain: TEST_SUBDOMAIN,
          loginEmail: RECYCLE_EMAIL,
          passwordHash: "dummy_hash",
          name: "User C",
        });
      } catch (err: unknown) {
        threwConflict = true;
        const code = extractPgErrorCode(err);
        expect(code).toBe("23505"); // unique_violation
      }
      expect(threwConflict).toBe(true);
    } finally {
      await insCtx.rollback().catch(() => undefined);
    }
  });

  it("enforces RLS tenant_soft_delete_isolation hiding deleted records by default", async (ctx) => {
    if (!dbAvailable) {
      ctx.skip();
      return;
    }

    // Transaction executed under non-superuser role subject to Row Level Security
    const rlsTx = await beginLongLivedTenantTransaction(TEST_SUBDOMAIN);
    try {
      await rlsTx.tx.execute(sql`SET LOCAL ROLE mms_test_tenant_role`);
      await rlsTx.tx.execute(sql`SELECT
        set_config('app.current_tenant', ${TEST_SUBDOMAIN}, true),
        set_config('app.rls_bypass', 'off', true)
      `);

      // Query students without any application-level "WHERE deleted_at IS NULL" filter
      const activeOnly = await rlsTx.tx
        .select({ id: students.id, grNumber: students.grNumber })
        .from(students)
        .where(eq(students.workspaceSubdomain, TEST_SUBDOMAIN));

      const activeIds = activeOnly.map((s) => s.id);
      expect(activeIds).toContain("stu-recycle-b");
      // Soft-deleted student A must be hidden by PostgreSQL RLS policy
      expect(activeIds).not.toContain("stu-recycle-a");

      // Now request archived records within the transaction boundary
      await rlsTx.tx.execute(sql`SELECT set_config('app.include_deleted', 'true', true)`);

      const allRecords = await rlsTx.tx
        .select({ id: students.id, grNumber: students.grNumber })
        .from(students)
        .where(eq(students.workspaceSubdomain, TEST_SUBDOMAIN));

      const allIds = allRecords.map((s) => s.id);
      expect(allIds).toContain("stu-recycle-a");
      expect(allIds).toContain("stu-recycle-b");

      await rlsTx.commit();
    } catch (error) {
      await rlsTx.rollback().catch(() => undefined);
      throw error;
    }
  });
});
