import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray, sql } from "drizzle-orm";
import type { User } from "@mms/shared";
import { activeDb, beginLongLivedTenantTransaction, closeDatabase } from "../../db/dbConnection.js";
import { withGlobalTenant, withTenant } from "../../db/tenant-context.js";
import {
  auditMerkleRoots,
  auditTrailEvents,
  contacts,
  documentTemplates,
  students,
  workshopEvents,
  workshopModulePreferences,
  workshopParticipants,
  workspaces,
} from "../../db/schema.js";
import {
  getDocumentTemplateUseCase,
  saveDocumentTemplateUseCase,
} from "../../documents/use-cases/documentTemplatesUseCases.js";
import { GENESIS_AUDIT_HASH } from "@mms/shared";
import { getLatestShardHash } from "../../services/auditTrailService.js";
import { listMerkleRoots } from "../../audit/repository/auditQueryAdapter.js";
import { requireDatabaseConnection } from "../db-integration/dbTestSupport.js";

/**
 * Proves tenant isolation under a real non-bypass Postgres role. Every query
 * here is one the application actually runs:
 *   - a tenant transaction sees only its own rows;
 *   - a query outside any transaction sees nothing (RLS is not decorative);
 *   - document-template CRUD works through its tenant-scoped use cases;
 *   - the audit shard head is real after an event, not the genesis hash.
 */
const TENANT_A = "x-rls-a";
const TENANT_B = "x-rls-b";
const USER = { id: "u-rls", role: "admin" } as User;

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
  for (const tenant of [TENANT_A, TENANT_B]) {
    await withTenant(tenant, async (tx) => {
      await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
      await tx
        .delete(workshopParticipants)
        .where(eq(workshopParticipants.workspaceSubdomain, tenant));
      await tx.delete(workshopEvents).where(eq(workshopEvents.workspaceSubdomain, tenant));
      await tx
        .delete(workshopModulePreferences)
        .where(eq(workshopModulePreferences.workspaceSubdomain, tenant));
      await tx.delete(contacts).where(eq(contacts.workspaceSubdomain, tenant));
    }).catch(() => undefined);
  }

  const tx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
  try {
    await tx.tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    const tenants = [TENANT_A, TENANT_B];
    await tx.tx
      .delete(documentTemplates)
      .where(inArray(documentTemplates.workspaceSubdomain, tenants));
    await tx.tx
      .delete(auditTrailEvents)
      .where(inArray(auditTrailEvents.workspaceSubdomain, tenants));
    await tx.tx.delete(students).where(inArray(students.workspaceSubdomain, tenants));
    await tx.tx.delete(auditMerkleRoots).where(eq(auditMerkleRoots.id, "merkle-rls-test"));
    await tx.tx.delete(workspaces).where(inArray(workspaces.subdomain, tenants));
    await tx.commit();
  } catch (error) {
    await tx.rollback().catch(() => undefined);
    throw error;
  }
}

describe("RLS enforcement", () => {
  beforeAll(async () => {
    await requireDatabaseConnection();
    await assertNonBypassRole();
    await cleanup();

    await withGlobalTenant(async (tx) => {
      await tx.insert(workspaces).values([
        { id: "ws-rls-a", subdomain: TENANT_A, madrasaName: "RLS A", enabled: true },
        { id: "ws-rls-b", subdomain: TENANT_B, madrasaName: "RLS B", enabled: true },
      ]);
      await tx.insert(students).values([
        { id: "student-a", workspaceSubdomain: TENANT_A, status: "active" },
        { id: "student-b", workspaceSubdomain: TENANT_B, status: "active" },
      ]);
      await tx.insert(auditMerkleRoots).values({
        id: "merkle-rls-test",
        rootHash: "c".repeat(64),
        heads: { [TENANT_A]: "a".repeat(64), [TENANT_B]: "b".repeat(64) },
        periodStart: new Date("2026-10-01T00:00:00.000Z"),
        periodEnd: new Date("2026-10-31T23:59:59.999Z"),
        shardCount: 2,
        publishedAt: new Date("2026-11-01T00:00:00.000Z"),
      });
    });

    await withTenant(TENANT_A, async (tx) => {
      await tx.insert(contacts).values({
        id: "rls-c-a",
        workspaceSubdomain: TENANT_A,
        firstName: "A",
        name: "RLS A contact",
      });
      await tx.insert(workshopEvents).values({
        id: "w-a",
        workspaceSubdomain: TENANT_A,
        title: "A workshop",
        status: "open",
        startDate: "2099-01-01",
      });
      await tx.insert(workshopParticipants).values({
        id: "p-a",
        workspaceSubdomain: TENANT_A,
        workshopId: "w-a",
        contactId: "rls-c-a",
        status: "registered",
      });
      await tx.insert(workshopModulePreferences).values({
        workspaceSubdomain: TENANT_A,
        defaultMinAttendancePct: "80.00",
      });
    });

    await withTenant(TENANT_B, async (tx) => {
      await tx.insert(contacts).values({
        id: "rls-c-b",
        workspaceSubdomain: TENANT_B,
        firstName: "B",
        name: "RLS B contact",
      });
      await tx.insert(workshopEvents).values({
        id: "w-b",
        workspaceSubdomain: TENANT_B,
        title: "B workshop",
        status: "open",
        startDate: "2099-01-01",
      });
      await tx.insert(workshopParticipants).values({
        id: "p-b",
        workspaceSubdomain: TENANT_B,
        workshopId: "w-b",
        contactId: "rls-c-b",
        status: "registered",
      });
      await tx.insert(workshopModulePreferences).values({
        workspaceSubdomain: TENANT_B,
        defaultMinAttendancePct: "20.00",
      });
    });
  });

  afterAll(async () => {
    await cleanup();
    await closeDatabase();
  });

  it("scopes a tenant transaction to its own rows", async () => {
    const rows = await withTenant(TENANT_A, (tx) => tx.select({ id: students.id }).from(students));
    expect(rows.map((row) => row.id)).toEqual(["student-a"]);
  });

  it("scopes every workshop table to the tenant", async () => {
    const events = await withTenant(TENANT_A, (tx) =>
      tx.select({ id: workshopEvents.id }).from(workshopEvents),
    );
    const participants = await withTenant(TENANT_A, (tx) =>
      tx.select({ id: workshopParticipants.id }).from(workshopParticipants),
    );
    const preferences = await withTenant(TENANT_A, (tx) =>
      tx
        .select({ attendance: workshopModulePreferences.defaultMinAttendancePct })
        .from(workshopModulePreferences),
    );
    expect(events.map((row) => row.id)).toEqual(["w-a"]);
    expect(participants.map((row) => row.id)).toEqual(["p-a"]);
    expect(preferences).toHaveLength(1);

    const outside = await activeDb().select({ id: workshopEvents.id }).from(workshopEvents);
    expect(outside).toEqual([]);
  });

  it("returns no tenant rows outside a transaction (RLS is enforced)", async () => {
    const rows = await activeDb().select({ id: students.id }).from(students);
    expect(rows).toEqual([]);
  });

  it("round-trips a document template through its tenant-scoped use cases", async () => {
    const template = { pageSize: "A6", elements: [] };

    await saveDocumentTemplateUseCase(TENANT_A, "invoice", template, USER, null);

    await expect(getDocumentTemplateUseCase(TENANT_A, "invoice")).resolves.toMatchObject({
      template,
      updatedAt: expect.any(Date),
    });
    await expect(getDocumentTemplateUseCase(TENANT_B, "invoice")).resolves.toBeNull();
  });

  it("returns a real audit shard head after an event", async () => {
    const headA = await getLatestShardHash(TENANT_A);
    const headB = await getLatestShardHash(TENANT_B);

    expect(headA).not.toBe(GENESIS_AUDIT_HASH);
    expect(headB).toBe(GENESIS_AUDIT_HASH);
  });

  it("projects only the caller's head from a published Merkle checkpoint", async () => {
    const [checkpoint] = await listMerkleRoots(TENANT_A);
    expect(checkpoint?.headHash).toBe("a".repeat(64));
    expect(checkpoint).not.toHaveProperty("heads");
  });
});
