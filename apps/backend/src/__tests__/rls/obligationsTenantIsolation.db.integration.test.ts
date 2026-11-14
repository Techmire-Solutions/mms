import pg from "pg";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, sql } from "drizzle-orm";
import { closeDatabase, beginLongLivedTenantTransaction } from "../../db/dbConnection.js";
import { withTenant, withTenantRead } from "../../db/tenant-context.js";
import {
  contacts,
  obligationCollections,
  obligationDistributions,
  obligationModulePreferences,
  obligationTypes,
  mujtahids,
  mujtahidReps,
  wakalaTypes,
  workspaces,
} from "../../db/schema.js";
import { requireDatabaseConnection } from "../db-integration/dbTestSupport.js";

/**
 * Tenant isolation and RLS-policy integrity for the Obligations tables.
 *
 * Defence in depth: every obligation repository filters `workspace_subdomain`, and FORCE RLS backs
 * that up. This suite runs as a NOSUPERUSER NOBYPASSRLS role (the CI `test-backend-rls` job) so it
 * proves isolation even for a query that carries no WHERE clause — running it under `postgres`
 * would prove nothing.
 *
 * It also pins the RLS policy inventory: migration 0259 removed the duplicate permissive policies
 * that 0052 left behind on five catalogue tables. Permissive policies are OR-ed, so a stray second
 * policy can silently defeat any stricter predicate added later (the 0229 defect class).
 */

const TENANT_A = "obl-iso-a";
const TENANT_B = "obl-iso-b";

/**
 * The one policy each table must have. `obligation_collections` carries the soft-delete-aware policy
 * from 0108 (recreated by 0258); the rest carry 0076's `tenant_isolation_policy`. Exactly one either
 * way — 0259 removed the duplicate permissive policies 0052 left behind.
 */
const OBLIGATION_POLICIES: ReadonlyArray<[table: string, policy: string]> = [
  ["obligation_collections", "tenant_soft_delete_isolation"],
  ["obligation_types", "tenant_isolation_policy"],
  ["mujtahids", "tenant_isolation_policy"],
  ["mujtahid_reps", "tenant_isolation_policy"],
  ["wakala_types", "tenant_isolation_policy"],
  ["obligation_distributions", "tenant_isolation_policy"],
  ["obligation_module_preferences", "tenant_isolation_policy"],
];

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
      await tx.tx
        .delete(obligationModulePreferences)
        .where(eq(obligationModulePreferences.workspaceSubdomain, tenant));
      await tx.tx
        .delete(obligationDistributions)
        .where(eq(obligationDistributions.workspaceSubdomain, tenant));
      await tx.tx.delete(wakalaTypes).where(eq(wakalaTypes.workspaceSubdomain, tenant));
      await tx.tx.delete(obligationTypes).where(eq(obligationTypes.workspaceSubdomain, tenant));
      await tx.tx.delete(mujtahidReps).where(eq(mujtahidReps.workspaceSubdomain, tenant));
      await tx.tx.delete(mujtahids).where(eq(mujtahids.workspaceSubdomain, tenant));
      await tx.tx
        .delete(obligationCollections)
        .where(eq(obligationCollections.workspaceSubdomain, tenant));
      await tx.tx.delete(contacts).where(eq(contacts.workspaceSubdomain, tenant));
      await tx.tx.delete(workspaces).where(eq(workspaces.subdomain, tenant));
    }
    await tx.commit();
  } catch (error) {
    await tx.rollback().catch(() => undefined);
    throw error;
  }
}

async function seedTenant(tenant: string): Promise<void> {
  const typeId = `ot-${tenant}`;
  const mujtahidId = `mj-${tenant}`;
  const repId = `rep-${tenant}`;
  const wakalaId = `wk-${tenant}`;

  await withTenant(tenant, async (tx) => {
    await tx
      .insert(workspaces)
      .values({ id: `ws-${tenant}`, subdomain: tenant, madrasaName: `Isolation ${tenant}` })
      .onConflictDoNothing();
    // 0258 added the (workspace_subdomain, sender_id) → contacts FK.
    await tx.insert(contacts).values({
      id: `cnt-${tenant}`,
      workspaceSubdomain: tenant,
      firstName: "Isolation",
      name: "Isolation Sender",
    });
    await tx.insert(obligationTypes).values({
      id: typeId,
      workspaceSubdomain: tenant,
      name: `Khums ${tenant}`,
    });
    await tx
      .insert(mujtahids)
      .values({ id: mujtahidId, workspaceSubdomain: tenant, name: `M ${tenant}` });
    await tx.insert(mujtahidReps).values({
      id: repId,
      workspaceSubdomain: tenant,
      mujtahidId,
      name: `Rep ${tenant}`,
    });
    await tx.insert(wakalaTypes).values({
      id: wakalaId,
      workspaceSubdomain: tenant,
      mujtahidRepresentativeId: repId,
      obligationTypeId: typeId,
    });
    await tx.insert(obligationDistributions).values({
      id: `od-${tenant}`,
      workspaceSubdomain: tenant,
      wakalaTypeId: wakalaId,
      name: `Share ${tenant}`,
      percentage: "100",
      type: "Income",
    });
    await tx.insert(obligationCollections).values({
      id: `oc-${tenant}`,
      workspaceSubdomain: tenant,
      receiptNo: `REC-${tenant}`,
      receivedDate: "2026-06-15",
      senderId: `cnt-${tenant}`,
      amount: "1500",
      currencyId: "PKR",
      paymentMode: "Cash",
      obligationTypeId: typeId,
      mujtahidRepresentativeId: repId,
      receivedBy: "u-admin",
    });
    await tx.insert(obligationModulePreferences).values({
      workspaceSubdomain: tenant,
      preferences: {},
    });
  });
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await assertNonBypassRole();
  await purge();
  await seedTenant(TENANT_A);
  await seedTenant(TENANT_B);
}, 60_000);

afterAll(async () => {
  await purge().catch(() => undefined);
  await closeDatabase();
});

describe("obligations tenant isolation", () => {
  it("returns only the current tenant's rows for an unfiltered read", async () => {
    const rows = await withTenantRead(TENANT_A, (tx) =>
      tx.select({ id: obligationCollections.id }).from(obligationCollections),
    );
    expect(rows.map((row) => row.id)).toEqual([`oc-${TENANT_A}`]);
  });

  it("cannot read another tenant's receipt even with an explicit id", async () => {
    const rows = await withTenantRead(TENANT_A, (tx) =>
      tx
        .select({ id: obligationCollections.id })
        .from(obligationCollections)
        .where(eq(obligationCollections.id, `oc-${TENANT_B}`)),
    );
    expect(rows).toHaveLength(0);
  });

  it("cannot update or delete another tenant's rows", async () => {
    await withTenant(TENANT_A, async (tx) => {
      const updated = await tx
        .update(obligationCollections)
        .set({ amount: "999.00" })
        .where(eq(obligationCollections.id, `oc-${TENANT_B}`))
        .returning({ id: obligationCollections.id });
      expect(updated).toHaveLength(0);
      const deleted = await tx
        .delete(obligationCollections)
        .where(eq(obligationCollections.id, `oc-${TENANT_B}`))
        .returning({ id: obligationCollections.id });
      expect(deleted).toHaveLength(0);
    });
    const survivor = await withTenantRead(TENANT_B, (tx) =>
      tx
        .select({ amount: obligationCollections.amount })
        .from(obligationCollections)
        .where(eq(obligationCollections.id, `oc-${TENANT_B}`)),
    );
    expect(survivor[0]?.amount).toBe("1500.00");
  });

  it("keeps every catalogue table isolated too", async () => {
    const [types, mujtahidsRows, reps, wakalas, distributions, prefs] = await Promise.all([
      withTenantRead(TENANT_A, (tx) =>
        tx.select({ ws: obligationTypes.workspaceSubdomain }).from(obligationTypes),
      ),
      withTenantRead(TENANT_A, (tx) =>
        tx.select({ ws: mujtahids.workspaceSubdomain }).from(mujtahids),
      ),
      withTenantRead(TENANT_A, (tx) =>
        tx.select({ ws: mujtahidReps.workspaceSubdomain }).from(mujtahidReps),
      ),
      withTenantRead(TENANT_A, (tx) =>
        tx.select({ ws: wakalaTypes.workspaceSubdomain }).from(wakalaTypes),
      ),
      withTenantRead(TENANT_A, (tx) =>
        tx.select({ ws: obligationDistributions.workspaceSubdomain }).from(obligationDistributions),
      ),
      withTenantRead(TENANT_A, (tx) =>
        tx
          .select({ ws: obligationModulePreferences.workspaceSubdomain })
          .from(obligationModulePreferences),
      ),
    ]);
    for (const rows of [types, mujtahidsRows, reps, wakalas, distributions, prefs]) {
      expect(rows.map((row) => row.ws)).toEqual([TENANT_A]);
    }
  });

  it("refuses a receipt that references another tenant's catalogue row", async () => {
    // The composite FK is (workspace_subdomain, id): a cross-tenant reference cannot be stored.
    await expect(
      withTenant(TENANT_A, (tx) =>
        tx.insert(obligationCollections).values({
          id: `oc-foreign-${TENANT_A}`,
          workspaceSubdomain: TENANT_A,
          receiptNo: `REC-foreign-${TENANT_A}`,
          receivedDate: "2026-06-15",
          senderId: `cnt-${TENANT_A}`,
          amount: "10",
          currencyId: "PKR",
          paymentMode: "Cash",
          obligationTypeId: `ot-${TENANT_B}`,
          mujtahidRepresentativeId: `rep-${TENANT_A}`,
          receivedBy: "u-admin",
        }),
      ),
    ).rejects.toThrow();
  });
});

describe("obligations RLS policy inventory", () => {
  it("has exactly one policy per obligation table, all FORCE-enabled", async () => {
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      for (const [table, expectedPolicy] of OBLIGATION_POLICIES) {
        const policies = await client.query<{ policy: string }>(
          `SELECT policyname AS policy FROM pg_policies WHERE schemaname = 'public' AND tablename = $1`,
          [table],
        );
        expect(policies.rows.map((row) => row.policy)).toEqual([expectedPolicy]);

        const forced = await client.query<{ forced: boolean }>(
          `SELECT relforcerowsecurity AS forced FROM pg_class WHERE oid = format('public.%I', $1::text)::regclass`,
          [table],
        );
        expect(forced.rows[0]?.forced).toBe(true);
      }
    } finally {
      await client.end().catch(() => undefined);
    }
  });
});
