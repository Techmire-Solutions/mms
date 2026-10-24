import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, sql } from "drizzle-orm";
import { closeDatabase, beginLongLivedTenantTransaction } from "../../db/dbConnection.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";
import { workspaces, tenantUsers } from "../../db/schema.js";
import {
  findTenantUserRowById,
  findTenantUserRowByIdGlobal,
  listTenantUsersByIds,
  listTenantUsersByIdsGlobal,
  countTenantUsersByWorkspace,
} from "../../db/repositories/tenantUserRepositoryHydrate.js";
import {
  softDeleteTenantUserRow,
  restoreTenantUserRow,
  verifyTenantUserEmailRow,
  resetTenantUserPasswordRow,
} from "../../db/repositories/tenantUserRepositoryPersist.js";
import { runWithTenant } from "../../lib/tenantContext.js";

/**
 * End-to-end reproduction of the cross-tenant `tenant_users` authorization
 * break, run against a real PostgreSQL instance.
 *
 * The original defect: `findTenantUserRowById(id)` / `listTenantUsersByIds(ids)`
 * looked a user up by id alone inside a transaction opened WITHOUT a tenant,
 * which sets `app.rls_bypass = 'on'` and makes the RLS policy match every row.
 * Tenant-reachable routes (`DELETE /api/users/:id`, `POST /api/users/bulk-delete`,
 * the CSV export path) called those helpers and only checked the CALLER's
 * permission — never that the target belonged to the caller's workspace — so an
 * admin in workspace A could read, soft-delete, restore, and email-verify users
 * in workspace B by supplying their id.
 *
 * This test proves the fix by ATTACKING it: workspace A is driven against a real
 * victim row in workspace B using the same repository/use-case entry points the
 * routes use, and every attempt must fail to observe or mutate B.
 */
const ATTACKER = "x-tenant-attacker";
const VICTIM = "x-tenant-victim";
const VICTIM_USER_ID = "victim-user-1";
const ATTACKER_USER_ID = "attacker-admin-1";

async function cleanup(): Promise<void> {
  const tx = await beginLongLivedTenantTransaction(null);
  try {
    await tx.tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    for (const subdomain of [ATTACKER, VICTIM]) {
      await tx.tx.delete(tenantUsers).where(eq(tenantUsers.workspaceSubdomain, subdomain));
      await tx.tx.delete(workspaces).where(eq(workspaces.subdomain, subdomain));
    }
    await tx.commit();
  } catch {
    await tx.rollback().catch(() => undefined);
  }
}

beforeAll(async () => {
  await requireDatabaseConnection();

  await cleanup();

  const tx = await beginLongLivedTenantTransaction(null);
  try {
    await tx.tx.insert(workspaces).values([
      { id: `ws-${ATTACKER}`, subdomain: ATTACKER, madrasaName: "Attacker Madrasa", enabled: true },
      { id: `ws-${VICTIM}`, subdomain: VICTIM, madrasaName: "Victim Madrasa", enabled: true },
    ]);
    await tx.tx.insert(tenantUsers).values([
      {
        id: ATTACKER_USER_ID,
        workspaceSubdomain: ATTACKER,
        loginEmail: "admin@attacker.test",
        passwordHash: "salt:attacker-hash",
        name: "Attacker Admin",
        role: "admin",
      },
      {
        id: VICTIM_USER_ID,
        workspaceSubdomain: VICTIM,
        loginEmail: "head@victim.test",
        passwordHash: "salt:victim-hash",
        name: "Victim Super Admin",
        role: "super_admin",
      },
    ]);
    await tx.commit();
  } catch (error) {
    await tx.rollback().catch(() => undefined);
    throw error;
  }
});

afterAll(async () => {
  await cleanup().catch(() => undefined);
  await closeDatabase().catch(() => undefined);
});

/** Reads the victim row through the global (RLS-bypassing) path, ignoring RLS. */
async function readVictimUnscoped() {
  return findTenantUserRowByIdGlobal(VICTIM_USER_ID);
}

describe("cross-tenant tenant_users isolation (exploit reproduction, real Postgres)", () => {
  it("confirms the victim row really is reachable by id when scoping is absent", async () => {
    // This is the pre-fix behaviour: an id-only lookup inside an RLS-bypassed
    // transaction finds the victim. If this returned null, the rest of the
    // suite would be proving nothing.
    const unscoped = await readVictimUnscoped();
    expect(unscoped, "victim row must exist for this test to be meaningful").not.toBeNull();
    expect(unscoped?.workspaceSubdomain).toBe(VICTIM);

    const unscopedList = await listTenantUsersByIdsGlobal([VICTIM_USER_ID]);
    expect(unscopedList).toHaveLength(1);
  });

  it("refuses to read a foreign workspace user by id", async () => {
    const viaScoped = await findTenantUserRowById(ATTACKER, VICTIM_USER_ID);
    expect(viaScoped).toBeNull();

    const viaScopedList = await listTenantUsersByIds(ATTACKER, [VICTIM_USER_ID]);
    expect(viaScopedList).toEqual([]);
  });

  it("refuses to soft-delete a foreign workspace user", async () => {
    const result = await softDeleteTenantUserRow(ATTACKER, VICTIM_USER_ID, ATTACKER_USER_ID);
    expect(result).toBe(false);

    // The victim must be completely untouched.
    const victimAfter = await readVictimUnscoped();
    expect(victimAfter?.deletedAt).toBeNull();
    expect(victimAfter?.deletedBy).toBeNull();
  });

  it("refuses to restore a foreign workspace user", async () => {
    // Soft-delete the victim legitimately (as the victim workspace) so a
    // restore attempt has something to target.
    const victimTxnDeleted = await softDeleteTenantUserRow(VICTIM, VICTIM_USER_ID, "victim-admin");
    expect(victimTxnDeleted).toBe(true);

    const attackerRestore = await restoreTenantUserRow(ATTACKER, VICTIM_USER_ID);
    expect(attackerRestore).toBe(false);

    // Still soft-deleted: the attacker's attempt changed nothing.
    const victimAfter = await readVictimUnscoped();
    expect(victimAfter?.deletedAt).not.toBeNull();

    // Clean up via the owning workspace.
    await restoreTenantUserRow(VICTIM, VICTIM_USER_ID);
    const restored = await readVictimUnscoped();
    expect(restored?.deletedAt).toBeNull();
  });

  it("refuses to email-verify a foreign workspace user", async () => {
    const result = await verifyTenantUserEmailRow(ATTACKER, VICTIM_USER_ID);
    expect(result).toBe(false);

    // `rowToTenantUser` only sets emailVerifiedAt when truthy, so an unverified
    // user surfaces as undefined rather than null.
    const victimAfter = await readVictimUnscoped();
    expect(victimAfter?.emailVerifiedAt).toBeUndefined();
  });

  it("refuses to reset a foreign workspace user password", async () => {
    const result = await resetTenantUserPasswordRow(
      ATTACKER,
      VICTIM_USER_ID,
      "salt:attacker-chosen-hash",
    );
    expect(result).toBe(false);

    const victimAfter = await readVictimUnscoped();
    expect(victimAfter?.passwordHash).toBe("salt:victim-hash");
    expect(victimAfter?.mustChangePassword).toBe(false);
  });

  it("scopes the users use-cases to the request workspace", async () => {
    const { usersUseCases } = await import("../../users/use-cases/usersUseCases.js");

    // The routes wrap their work in the request tenant, exactly as here.
    const seenFromAttacker = await runWithTenant(ATTACKER, () =>
      usersUseCases.loadUserById(VICTIM_USER_ID),
    );
    expect(seenFromAttacker).toBeNull();

    const listFromAttacker = await runWithTenant(ATTACKER, () =>
      usersUseCases.loadUsersByIds([VICTIM_USER_ID]),
    );
    expect(listFromAttacker).toEqual([]);

    // deleteUserById is the `DELETE /api/users/:id` path. It must not find the
    // victim, so it reports "not deleted" rather than touching workspace B.
    const deletedByAttacker = await runWithTenant(ATTACKER, () =>
      usersUseCases.deleteUserById(VICTIM_USER_ID, ATTACKER_USER_ID, "admin"),
    );
    expect(deletedByAttacker).toBe(false);

    const victimAfter = await readVictimUnscoped();
    expect(victimAfter?.deletedAt).toBeNull();
  });

  it("still lets a workspace act on its own users", async () => {
    // Guards against the fix being an over-correction that breaks legitimate use.
    const ownRow = await findTenantUserRowById(ATTACKER, ATTACKER_USER_ID);
    expect(ownRow?.id).toBe(ATTACKER_USER_ID);

    const count = await countTenantUsersByWorkspace(ATTACKER);
    expect(count).toBe(1);
  });
});
