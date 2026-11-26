import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inArray, sql } from "drizzle-orm";
import { beginLongLivedTenantTransaction, closeDatabase } from "@mms/db/client";
import { withGlobalTenant } from "@mms/db/context";
import { tenantUsers, workspaces } from "@mms/db/schema";
import { iamPorts } from "../../modules/iam/adapters.js";
import { requireDatabaseConnection, uniqueTenant } from "./dbTestSupport.js";

/**
 * Proves the platform IAM adapter's cross-tenant SQL against real Postgres:
 * keyset-free offset pagination, deterministic ordering, `count(*)` totals that
 * match the page query, soft-delete exclusion, and per-tenant scoping of
 * `findTenantUser`. The module's unit tests stub these ports, so this is the
 * only suite that executes the statements.
 */
const TOKEN = `ZzIam${randomUUID().slice(0, 8)}`;
const TENANT_A = uniqueTenant(`${TOKEN}-a`);
const TENANT_B = uniqueTenant(`${TOKEN}-b`);
const USER_A1 = "u-iam-a1";
const USER_A2 = "u-iam-a2";
const USER_A3 = "u-iam-a3";
const USER_B1 = "u-iam-b1";

function userRow(input: { id: string; tenant: string; name: string; deletedAt?: Date | null }) {
  return {
    id: input.id,
    workspaceSubdomain: input.tenant,
    loginEmail: `${input.id}-${TOKEN}@example.com`,
    passwordHash: "not-a-real-hash",
    name: input.name,
    role: "teacher",
    profileJson: { status: "active" },
    deletedAt: input.deletedAt ?? null,
  };
}

async function cleanup(): Promise<void> {
  const tx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
  try {
    await tx.tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    const tenants = [TENANT_A, TENANT_B];
    await tx.tx.delete(tenantUsers).where(inArray(tenantUsers.workspaceSubdomain, tenants));
    await tx.tx.delete(workspaces).where(inArray(workspaces.subdomain, tenants));
    await tx.commit();
  } catch (error) {
    await tx.rollback().catch(() => undefined);
    throw error;
  }
}

describe("platform IAM adapter (real Postgres)", () => {
  beforeAll(async () => {
    await requireDatabaseConnection();
    await cleanup();
    await withGlobalTenant(async (tx) => {
      await tx.insert(workspaces).values([
        {
          id: `ws-${TENANT_A}`,
          subdomain: TENANT_A,
          madrasaName: `${TOKEN} Madrasa A`,
          enabled: true,
        },
        {
          id: `ws-${TENANT_B}`,
          subdomain: TENANT_B,
          madrasaName: `${TOKEN} Madrasa B`,
          enabled: true,
        },
      ]);
      await tx.insert(tenantUsers).values([
        userRow({ id: USER_A1, tenant: TENANT_A, name: `${TOKEN} Alpha` }),
        userRow({
          id: USER_A2,
          tenant: TENANT_A,
          name: `${TOKEN} Beta`,
          deletedAt: new Date(),
        }),
        userRow({ id: USER_A3, tenant: TENANT_A, name: `${TOKEN} Gamma` }),
        userRow({ id: USER_B1, tenant: TENANT_B, name: `${TOKEN} Delta` }),
      ]);
    });
  });

  afterAll(async () => {
    await cleanup();
    await closeDatabase();
  });

  it("paginates cross-tenant users in deterministic name order", async () => {
    const pageOne = await iamPorts.platform.searchUsers(TOKEN, 2, 0);
    expect(pageOne.map((row: any) => row.user.name)).toEqual([`${TOKEN} Alpha`, `${TOKEN} Delta`]);
    expect(new Set(pageOne.map((row: any) => row.tenant))).toEqual(new Set([TENANT_A, TENANT_B]));

    const pageTwo = await iamPorts.platform.searchUsers(TOKEN, 2, 2);
    expect(pageTwo.map((row: any) => row.user.name)).toEqual([`${TOKEN} Gamma`]);
  });

  it("counts exactly the rows the page query can return (soft-deleted excluded)", async () => {
    expect(await iamPorts.platform.countUsers(TOKEN)).toBe(3);
    const all = await iamPorts.platform.searchUsers(TOKEN, 50, 0);
    expect(all).toHaveLength(3);
    expect(all.some((row: any) => row.user.id === USER_A2)).toBe(false);
  });

  it("searches and counts organizations with the same offset semantics", async () => {
    const pageOne = await iamPorts.platform.searchOrganizations(TOKEN, 1, 0);
    expect(pageOne).toHaveLength(1);
    expect(pageOne[0]?.subdomain).toBe(TENANT_A);
    const pageTwo = await iamPorts.platform.searchOrganizations(TOKEN, 1, 1);
    expect(pageTwo[0]?.subdomain).toBe(TENANT_B);
    expect(await iamPorts.platform.countOrganizations(TOKEN)).toBe(2);
  });

  it("scopes findTenantUser to the requested tenant", async () => {
    const own = await iamPorts.platform.findTenantUser(TENANT_A, USER_A1);
    expect(own?.id).toBe(USER_A1);
    expect(await iamPorts.platform.findTenantUser(TENANT_B, USER_A1)).toBeNull();
  });

  it("persists suspension in profileJson without touching other tenants", async () => {
    const suspended = await iamPorts.platform.setTenantUserStatus(
      TENANT_A,
      USER_A1,
      "suspended",
      "support request for abuse",
    );
    expect(suspended.status).toBe("suspended");
    expect((await iamPorts.platform.findTenantUser(TENANT_A, USER_A1))?.status).toBe("suspended");

    const otherTenant = await iamPorts.platform.findTenantUser(TENANT_B, USER_B1);
    expect(otherTenant?.status).toBe("active");

    const reactivated = await iamPorts.platform.setTenantUserStatus(
      TENANT_A,
      USER_A1,
      "active",
      "appeal upheld",
    );
    expect(reactivated.status).toBe("active");
    expect((await iamPorts.platform.findTenantUser(TENANT_A, USER_A1))?.status).toBe("active");
  });
});
