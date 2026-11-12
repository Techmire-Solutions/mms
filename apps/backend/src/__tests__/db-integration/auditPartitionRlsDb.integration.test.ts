import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withGlobalTenant, withTenant } from "../../db/tenant-context.js";
import { beginLongLivedTenantTransaction } from "../../db/dbConnection.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import { workspaces } from "../../db/schema.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const SUFFIX = randomUUID().slice(0, 8);
const TENANT_A = `audit-rls-a-${SUFFIX}`;
const TENANT_B = `audit-rls-b-${SUFFIX}`;
const TENANTS = [TENANT_A, TENANT_B];

async function appendAudit(tenant: string): Promise<void> {
  await withTenant(tenant, (tx) =>
    recordModernAuditEvent(tx as never, {
      workspaceSubdomain: tenant,
      tableName: "finance_invoices",
      recordId: `inv-${tenant}`,
      actionType: "CREATE",
      newState: { id: `inv-${tenant}`, status: "pending" },
    }),
  );
}

async function cleanup(): Promise<void> {
  await withGlobalTenant(async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    for (const tenant of TENANTS) {
      await tx.execute(sql`DELETE FROM audit_trail_events WHERE workspace_subdomain = ${tenant}`);
      await tx.execute(sql`DELETE FROM workspaces WHERE subdomain = ${tenant}`);
    }
  });
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await cleanup();
  await withGlobalTenant(async (tx) => {
    await tx.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mms_test_tenant_role') THEN
          CREATE ROLE mms_test_tenant_role NOSUPERUSER NOBYPASSRLS;
        END IF;
      END $$;
    `);
    await tx.execute(sql`GRANT USAGE ON SCHEMA public TO mms_test_tenant_role`);
    await tx.execute(sql`GRANT ALL ON ALL TABLES IN SCHEMA public TO mms_test_tenant_role`);
    await tx.execute(sql`GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO mms_test_tenant_role`);
    await tx.insert(workspaces).values(
      TENANTS.map((subdomain) => ({
        id: subdomain,
        subdomain,
        madrasaName: subdomain,
        enabled: true,
      })),
    );
  });
  await appendAudit(TENANT_A);
  await appendAudit(TENANT_B);
});

afterAll(async () => {
  await cleanup();
  await closeDatabase();
});

/** Resolve the physical partition the two fixture rows landed in. */
async function fixturePartition(): Promise<string> {
  const rows = await withTenant(TENANT_A, (tx) =>
    tx.execute(sql`
      SELECT tableoid::regclass::text AS partition
        FROM audit_trail_events
       WHERE workspace_subdomain = ${TENANT_A}
       LIMIT 1
    `),
  );
  const partition = (rows.rows as Array<{ partition?: string }>)[0]?.partition;
  if (!partition) throw new Error("fixture audit row not found");
  return partition;
}

describe("audit partition row-level security (real Postgres)", () => {
  it("filters both the parent and the physical partition by the request tenant", async () => {
    const partition = await fixturePartition();
    // The two fixture rows share a month, so the default/parent filter is not enough:
    // a partition read without its own policy would expose both tenants.
    const { tx, rollback } = await beginLongLivedTenantTransaction(TENANT_A);
    try {
      await tx.execute(sql`SET LOCAL ROLE mms_test_tenant_role`);
      await tx.execute(sql`SELECT
        set_config('app.current_tenant', ${TENANT_A}, true),
        set_config('app.rls_bypass', 'off', true)
      `);

      const parent = await tx.execute(sql`
        SELECT count(*)::int AS n FROM audit_trail_events
         WHERE table_name = 'finance_invoices'
      `);
      expect(Number((parent.rows as Array<{ n: number }>)[0]?.n ?? 0)).toBe(1);

      // Direct partition access — the path that had no policy before 0250.
      const direct = await tx.execute(
        sql.raw(
          `SELECT count(*)::int AS n FROM "${partition}" WHERE table_name = 'finance_invoices'`,
        ),
      );
      expect(Number((direct.rows as Array<{ n: number }>)[0]?.n ?? 0)).toBe(1);
    } finally {
      await rollback().catch(() => undefined);
    }
  });
});
