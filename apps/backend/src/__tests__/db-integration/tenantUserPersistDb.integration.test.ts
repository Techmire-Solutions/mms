import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, sql } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  initializeDatabaseConnection,
  pingDatabase,
  closeDatabase,
  beginLongLivedTenantTransaction,
} from "../../db/dbConnection.js";
import { workspaces, tenantUsers } from "../../db/schema.js";
import { upsertTenantUsersBatch } from "../../db/repositories/tenantUserRepositoryPersist.js";
import type { TenantUserRow } from "../../db/repositories/tenantUserRepositoryHydrate.js";

const TEST_SUBDOMAIN = "perf-parity-users";

/** Backend root from this test file (src/__tests__/db-integration -> backend). */
const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
function applyDatabaseUrlFromEnvFile(): void {
  if (process.env.DATABASE_URL) return;
  try {
    const content = readFileSync(join(backendRoot, ".env"), "utf-8");
    const match = content.match(/^DATABASE_URL\s*=\s*"?([^"\n]+)"?$/m);
    if (match) process.env.DATABASE_URL = match[1].trim();
  } catch {
    // no .env present — loadServerConfig will use its test default
  }
}

let dbAvailable = false;

beforeAll(async () => {
  applyDatabaseUrlFromEnvFile();
  initializeDatabaseConnection();
  dbAvailable = await pingDatabase();
  if (!dbAvailable) return;

  const preCleanupTx = await beginLongLivedTenantTransaction(null);
  try {
    await preCleanupTx.tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await preCleanupTx.tx
      .delete(tenantUsers)
      .where(eq(tenantUsers.workspaceSubdomain, TEST_SUBDOMAIN));
    await preCleanupTx.tx.delete(workspaces).where(eq(workspaces.subdomain, TEST_SUBDOMAIN));
    await preCleanupTx.commit();
  } catch {
    await preCleanupTx.rollback().catch(() => undefined);
  }

  const seedTx = await beginLongLivedTenantTransaction(null);
  try {
    await seedTx.tx.insert(workspaces).values({
      id: "ws-perf-parity-users",
      subdomain: TEST_SUBDOMAIN,
      madrasaName: "Perf Parity Users",
      enabled: true,
    });
    // Existing user that the batch will update (with a stored credential).
    await seedTx.tx.insert(tenantUsers).values({
      id: "user-existing",
      workspaceSubdomain: TEST_SUBDOMAIN,
      loginEmail: "existing@example.com",
      passwordHash: "stored-hash",
      name: "Old Name",
      role: "assistant_teacher",
      updatedAt: new Date(),
    });
    await seedTx.commit();
  } catch (error) {
    await seedTx.rollback().catch(() => undefined);
    throw error;
  }
});

afterAll(async () => {
  if (dbAvailable) {
    const cleanupTx = await beginLongLivedTenantTransaction(null);
    try {
      await cleanupTx.tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
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

describe("upsertTenantUsersBatch batched upsert parity", () => {
  it("updates existing users (preserving credentials) and inserts new users", async (ctx) => {
    if (!dbAvailable) {
      ctx.skip();
      return;
    }

    const batch: TenantUserRow[] = [
      {
        id: "user-existing",
        workspaceSubdomain: TEST_SUBDOMAIN,
        loginEmail: "existing@example.com",
        // Empty passwordHash must fall back to the stored credential.
        passwordHash: "",
        name: "New Name",
        role: "admin",
      },
      {
        id: "user-new",
        workspaceSubdomain: TEST_SUBDOMAIN,
        loginEmail: "new@example.com",
        passwordHash: "new-hash",
        name: "New User",
        role: "assistant_teacher",
      },
    ];

    await upsertTenantUsersBatch(TEST_SUBDOMAIN, batch);

    const verifyTx = await beginLongLivedTenantTransaction(null);
    try {
      const rows = await verifyTx.tx
        .select()
        .from(tenantUsers)
        .where(eq(tenantUsers.workspaceSubdomain, TEST_SUBDOMAIN));
      const byId = new Map(rows.map((r) => [r.id, r]));

      // Existing user updated in place (not duplicated); new user inserted.
      expect(rows.length).toBe(2);
      expect(byId.get("user-existing")?.name).toBe("New Name");
      expect(byId.get("user-existing")?.role).toBe("admin");
      // Empty passwordHash fell back to the stored credential.
      expect(byId.get("user-existing")?.passwordHash).toBe("stored-hash");
      // Workspace preserved.
      expect(byId.get("user-existing")?.workspaceSubdomain).toBe(TEST_SUBDOMAIN);

      expect(byId.get("user-new")?.loginEmail).toBe("new@example.com");
      expect(byId.get("user-new")?.passwordHash).toBe("new-hash");

      await verifyTx.commit();
    } catch (error) {
      await verifyTx.rollback().catch(() => undefined);
      throw error;
    }
  });
});
