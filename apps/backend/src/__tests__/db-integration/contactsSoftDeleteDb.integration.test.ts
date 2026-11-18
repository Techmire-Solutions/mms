import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import {
  beginLongLivedTenantTransaction,
  closeDatabase,
  withActiveTransaction,
} from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { contacts, workspaces } from "../../db/schema.js";
import {
  bulkRestoreContactsSql,
  bulkSoftDeleteContactsSql,
} from "../../db/repositories/contactRepositorySoftDelete.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TEST_SUBDOMAIN = "contact-softdel-test";
const WORKSPACE_ID = "ws-contact-softdel-test";
const CONTACT_ID = "cnt-softdel-1";
const OTHER_TENANT = "contact-softdel-other";

/**
 * Pins the RLS soft-delete invariant that migration 0200 relies on: the write
 * primitive must opt into `app.include_deleted` for the transaction, or the
 * `deleted_at` UPDATE fails the RESTRICTIVE policy's WITH CHECK (reused from
 * USING) with SQLSTATE 42501 and the contact is never archived.
 *
 * Runs the production primitive under a `NOSUPERUSER NOBYPASSRLS` role so RLS is
 * genuinely enforced (a superuser/BYPASSRLS connection would bypass the policy
 * and turn this into a false green).
 */
beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();

  const setupTx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
  try {
    await setupTx.tx.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mms_test_tenant_role') THEN
          CREATE ROLE mms_test_tenant_role NOSUPERUSER NOBYPASSRLS;
        END IF;
      END $$;
      GRANT USAGE ON SCHEMA public TO mms_test_tenant_role;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO mms_test_tenant_role;
    `);
    await setupTx.tx
      .insert(workspaces)
      .values({
        id: WORKSPACE_ID,
        subdomain: TEST_SUBDOMAIN,
        madrasaName: "Contact Soft-delete Test Workspace",
        enabled: true,
      })
      .onConflictDoNothing();
    await setupTx.tx
      .insert(workspaces)
      .values({
        id: "ws-contact-softdel-other",
        subdomain: OTHER_TENANT,
        madrasaName: "Other Tenant",
        enabled: true,
      })
      .onConflictDoNothing();
    await setupTx.commit();
  } catch (error) {
    await setupTx.rollback().catch(() => undefined);
    throw error;
  }
});

afterAll(async () => {
  try {
    const cleanupTx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    try {
      await cleanupTx.tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
      await cleanupTx.tx.delete(contacts).where(eq(contacts.workspaceSubdomain, TEST_SUBDOMAIN));
      await cleanupTx.tx.delete(contacts).where(eq(contacts.workspaceSubdomain, OTHER_TENANT));
      await cleanupTx.tx.delete(workspaces).where(eq(workspaces.subdomain, TEST_SUBDOMAIN));
      await cleanupTx.tx.delete(workspaces).where(eq(workspaces.subdomain, OTHER_TENANT));
      await cleanupTx.commit();
    } catch {
      await cleanupTx.rollback().catch(() => undefined);
    }
  } finally {
    await closeDatabase();
  }
});

describe("contacts soft-delete under FORCE RLS (real Postgres)", () => {
  it("archives and restores a contact through the RLS policy", async () => {
    const seedTx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    try {
      await seedTx.tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
      await seedTx.tx.delete(contacts).where(eq(contacts.workspaceSubdomain, TEST_SUBDOMAIN));
      await seedTx.tx.insert(contacts).values({
        id: CONTACT_ID,
        workspaceSubdomain: TEST_SUBDOMAIN,
        firstName: "Aisha",
        lastName: "Khan",
        name: "Aisha Khan",
      });
      await seedTx.commit();
    } catch (error) {
      await seedTx.rollback().catch(() => undefined);
      throw error;
    }

    // 1) Soft-delete through the production primitive, as a NOBYPASSRLS tenant role.
    const deleteTx = await beginLongLivedTenantTransaction(TEST_SUBDOMAIN);
    try {
      await deleteTx.tx.execute(sql`SET LOCAL ROLE mms_test_tenant_role`);
      const outcome = await withActiveTransaction(deleteTx.tx, () =>
        bulkSoftDeleteContactsSql(TEST_SUBDOMAIN, [CONTACT_ID], "u-admin", "Left the madrasa"),
      );
      expect(outcome.succeeded).toBe(1);
      expect(outcome.failed).toBe(0);
      await deleteTx.commit();
    } catch (error) {
      await deleteTx.rollback().catch(() => undefined);
      throw error;
    }

    // 2) RLS hides the trashed row for the tenant unless `app.include_deleted` is set.
    const readTx = await beginLongLivedTenantTransaction(TEST_SUBDOMAIN);
    try {
      await readTx.tx.execute(sql`SET LOCAL ROLE mms_test_tenant_role`);
      await readTx.tx.execute(sql`
        SELECT
          set_config('app.current_tenant', ${TEST_SUBDOMAIN}, true),
          set_config('app.rls_bypass', 'off', true)
      `);

      const hidden = await readTx.tx
        .select({ id: contacts.id })
        .from(contacts)
        .where(and(eq(contacts.workspaceSubdomain, TEST_SUBDOMAIN), eq(contacts.id, CONTACT_ID)));
      expect(hidden).toHaveLength(0);

      await readTx.tx.execute(sql`SELECT set_config('app.include_deleted', 'true', true)`);
      const archived = await readTx.tx
        .select({
          id: contacts.id,
          deletedAt: contacts.deletedAt,
          deletionReason: contacts.deletionReason,
        })
        .from(contacts)
        .where(and(eq(contacts.workspaceSubdomain, TEST_SUBDOMAIN), eq(contacts.id, CONTACT_ID)));
      expect(archived).toHaveLength(1);
      expect(archived[0]?.deletedAt).toBeTruthy();
      expect(archived[0]?.deletionReason).toBe("Left the madrasa");
      await readTx.commit();
    } catch (error) {
      await readTx.rollback().catch(() => undefined);
      throw error;
    }

    // 3) Cross-tenant isolation: another tenant never sees the row, even with include_deleted.
    const otherTx = await beginLongLivedTenantTransaction(OTHER_TENANT);
    try {
      await otherTx.tx.execute(sql`SET LOCAL ROLE mms_test_tenant_role`);
      await otherTx.tx.execute(sql`
        SELECT
          set_config('app.current_tenant', ${OTHER_TENANT}, true),
          set_config('app.rls_bypass', 'off', true),
          set_config('app.include_deleted', 'true', true)
      `);
      const leaked = await otherTx.tx
        .select({ id: contacts.id })
        .from(contacts)
        .where(eq(contacts.id, CONTACT_ID));
      expect(leaked).toHaveLength(0);
      await otherTx.commit();
    } catch (error) {
      await otherTx.rollback().catch(() => undefined);
      throw error;
    }

    // 4) Restore through the primitive (deleted_at → NULL) also passes RLS.
    const restoreTx = await beginLongLivedTenantTransaction(TEST_SUBDOMAIN);
    try {
      await restoreTx.tx.execute(sql`SET LOCAL ROLE mms_test_tenant_role`);
      const outcome = await withActiveTransaction(restoreTx.tx, () =>
        bulkRestoreContactsSql(TEST_SUBDOMAIN, [CONTACT_ID], "u-admin"),
      );
      expect(outcome.succeeded).toBe(1);
      expect(outcome.failed).toBe(0);

      await restoreTx.tx.execute(sql`SELECT set_config('app.include_deleted', 'true', true)`);
      const restored = await restoreTx.tx
        .select({ id: contacts.id, deletedAt: contacts.deletedAt })
        .from(contacts)
        .where(and(eq(contacts.workspaceSubdomain, TEST_SUBDOMAIN), eq(contacts.id, CONTACT_ID)));
      expect(restored).toHaveLength(1);
      expect(restored[0]?.deletedAt).toBeNull();
      await restoreTx.commit();
    } catch (error) {
      await restoreTx.rollback().catch(() => undefined);
      throw error;
    }
  });
});
