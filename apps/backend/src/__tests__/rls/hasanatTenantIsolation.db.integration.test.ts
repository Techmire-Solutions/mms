import pg from "pg";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { closeDatabase, beginLongLivedTenantTransaction } from "../../db/dbConnection.js";
import { withTenant, withTenantRead } from "../../db/tenant-context.js";
import {
  hasanatBatches,
  hasanatDenoms,
  hasanatDistributions,
  hasanatRedemptions,
  hasanatStudentAwards,
  students,
  workspaces,
} from "../../db/schema.js";
import { requireDatabaseConnection } from "../db-integration/dbTestSupport.js";

/**
 * Tenant isolation for the Hasanat tables.
 *
 * Defence in depth: every repository filters `workspace_subdomain`, and FORCE RLS backs that up at
 * the database. This suite runs as a NOSUPERUSER NOBYPASSRLS role (the CI `test-backend-rls` job)
 * so it proves isolation holds even for a query that carries no WHERE clause — running it under
 * `postgres` (superuser / bypass RLS) would prove nothing.
 */

const TENANT_A = "hsn-iso-a";
const TENANT_B = "hsn-iso-b";

const TABLES = {
  denoms: "hasanat_denoms",
  batches: "hasanat_batches",
  distributions: "hasanat_distributions",
  redemptions: "hasanat_redemptions",
  awards: "hasanat_student_awards",
} as const;

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
        .delete(hasanatStudentAwards)
        .where(eq(hasanatStudentAwards.workspaceSubdomain, tenant));
      await tx.tx
        .delete(hasanatRedemptions)
        .where(eq(hasanatRedemptions.workspaceSubdomain, tenant));
      await tx.tx
        .delete(hasanatDistributions)
        .where(eq(hasanatDistributions.workspaceSubdomain, tenant));
      await tx.tx.delete(hasanatBatches).where(eq(hasanatBatches.workspaceSubdomain, tenant));
      await tx.tx.delete(hasanatDenoms).where(eq(hasanatDenoms.workspaceSubdomain, tenant));
      await tx.tx.delete(students).where(eq(students.workspaceSubdomain, tenant));
      await tx.tx.delete(workspaces).where(eq(workspaces.subdomain, tenant));
    }
    await tx.commit();
  } catch (error) {
    await tx.rollback().catch(() => undefined);
    throw error;
  }
}

async function seedTenant(tenant: string): Promise<void> {
  const studentId = `stu-${tenant}`;
  const denomId = `den-${tenant}`;
  const batchId = `bat-${tenant}`;
  const cardId = `hd-${tenant}`;

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
      await tx.insert(hasanatDenoms).values({
        id: denomId,
        workspaceSubdomain: tenant,
        name: `Gold ${tenant}`,
        points: 50,
      });
      await tx.insert(hasanatBatches).values({
        id: batchId,
        workspaceSubdomain: tenant,
        denominationId: denomId,
        denominationName: `Gold ${tenant}`,
        quantity: 10,
        remaining: 9,
        addedDate: "2026-11-01",
      });
      await tx.insert(hasanatDistributions).values({
        id: cardId,
        workspaceSubdomain: tenant,
        batchId,
        denominationId: denomId,
        recipientStudentId: studentId,
        recipientName: studentId,
        quantity: 1,
        pointsSnapshot: 50,
        issuedDate: "2026-11-01",
        issuedByUserId: "u-admin",
      });
      await tx.insert(hasanatRedemptions).values({
        id: `red-${tenant}`,
        workspaceSubdomain: tenant,
        distributionId: cardId,
        studentId,
        date: "2026-11-02",
        pointsUsed: 50,
      });
      await tx.insert(hasanatStudentAwards).values({
        id: `awd-${tenant}`,
        workspaceSubdomain: tenant,
        studentId,
        tierKey: "bronze",
        tierName: "Bronze",
        earnedSnapshot: 50,
      });
    },
    { readOnly: false },
  );
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await assertNonBypassRole();
  await purge();
  await seedTenant(TENANT_A);
  await seedTenant(TENANT_B);
}, 120_000);

afterAll(async () => {
  await purge();
  await closeDatabase();
});

describe("hasanat tenant isolation", () => {
  it("every hasanat tenant table enforces FORCE row level security", async () => {
    const tx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    try {
      const rows = await tx.tx.execute<{ relname: string; rls: boolean; forced: boolean }>(sql`
        SELECT c.relname, c.relrowsecurity AS rls, c.relforcerowsecurity AS forced
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public'
           AND c.relname IN (
             'hasanat_denoms', 'hasanat_batches', 'hasanat_distributions',
             'hasanat_redemptions', 'hasanat_student_awards'
           )
      `);
      const byName = new Map((rows.rows ?? []).map((row) => [row.relname, row]));
      for (const table of Object.values(TABLES)) {
        const entry = byName.get(table);
        expect(entry, `${table} missing`).toBeDefined();
        expect(entry?.rls, `${table} RLS not enabled`).toBe(true);
        expect(entry?.forced, `${table} RLS not forced`).toBe(true);
      }
    } finally {
      await tx.commit();
    }
  });

  it("a query without a WHERE clause still returns only the tenant's rows", async () => {
    const [cards, ledger, awards, denoms, batches] = await Promise.all([
      withTenantRead(TENANT_A, (tx) =>
        tx.select({ ws: hasanatDistributions.workspaceSubdomain }).from(hasanatDistributions),
      ),
      withTenantRead(TENANT_A, (tx) =>
        tx.select({ ws: hasanatRedemptions.workspaceSubdomain }).from(hasanatRedemptions),
      ),
      withTenantRead(TENANT_A, (tx) =>
        tx.select({ ws: hasanatStudentAwards.workspaceSubdomain }).from(hasanatStudentAwards),
      ),
      withTenantRead(TENANT_A, (tx) =>
        tx.select({ ws: hasanatDenoms.workspaceSubdomain }).from(hasanatDenoms),
      ),
      withTenantRead(TENANT_A, (tx) =>
        tx.select({ ws: hasanatBatches.workspaceSubdomain }).from(hasanatBatches),
      ),
    ]);

    for (const rows of [cards, ledger, awards, denoms, batches]) {
      expect(rows.length).toBeGreaterThan(0);
      expect(new Set(rows.map((row) => row.ws))).toEqual(new Set([TENANT_A]));
    }
  });

  it("cannot mutate another tenant's card, ledger row or award", async () => {
    const updated = await withTenant(
      TENANT_A,
      (tx) =>
        tx
          .update(hasanatDistributions)
          .set({ status: "returned" })
          .where(eq(hasanatDistributions.id, `hd-${TENANT_B}`))
          .returning({ id: hasanatDistributions.id }),
      { readOnly: false },
    );
    expect(updated).toHaveLength(0);

    const revoked = await withTenant(
      TENANT_A,
      (tx) =>
        tx
          .update(hasanatStudentAwards)
          .set({ revokedAt: new Date() })
          .where(eq(hasanatStudentAwards.id, `awd-${TENANT_B}`))
          .returning({ id: hasanatStudentAwards.id }),
      { readOnly: false },
    );
    expect(revoked).toHaveLength(0);

    const deletedLedger = await withTenant(
      TENANT_A,
      (tx) =>
        tx
          .delete(hasanatRedemptions)
          .where(eq(hasanatRedemptions.id, `red-${TENANT_B}`))
          .returning({ id: hasanatRedemptions.id }),
      { readOnly: false },
    );
    expect(deletedLedger).toHaveLength(0);

    const stillThere = await withTenantRead(TENANT_B, (tx) =>
      tx
        .select({ status: hasanatDistributions.status })
        .from(hasanatDistributions)
        .where(
          and(
            eq(hasanatDistributions.workspaceSubdomain, TENANT_B),
            eq(hasanatDistributions.id, `hd-${TENANT_B}`),
          ),
        ),
    );
    expect(stillThere[0]?.status).toBe("active");
  });

  it("rejects a cross-tenant card that points at another workspace's student", async () => {
    await expect(
      withTenant(
        TENANT_A,
        (tx) =>
          tx.insert(hasanatDistributions).values({
            id: "hd-cross",
            workspaceSubdomain: TENANT_A,
            batchId: `bat-${TENANT_A}`,
            denominationId: `den-${TENANT_A}`,
            recipientStudentId: `stu-${TENANT_B}`,
            issuedDate: "2026-11-01",
          }),
        { readOnly: false },
      ),
    ).rejects.toThrow(/foreign key|violates/i);
  });
});
