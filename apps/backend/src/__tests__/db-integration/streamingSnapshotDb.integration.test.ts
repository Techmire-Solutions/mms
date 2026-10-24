import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  initializeDatabaseConnection,
  pingDatabase,
  closeDatabase,
  beginLongLivedTenantTransaction,
} from "../../db/dbConnection.js";
import {
  streamTenantDocStoreSnapshot,
  streamSyncSnapshot,
  streamBackupSnapshot,
} from "../../db/streamingSnapshotProducer.js";
import { getAllData } from "../../db/documentStoreAdmin.js";
import { generateSnapshotJsonChunks } from "../../routes/common/db/snapshotJsonStream.js";
import { sanitizeSnapshot } from "../../routes/common/db/dbRouteHelpers.js";
import { fetchDatabaseSnapshot, fetchBackupSnapshot } from "../../services/dbSyncService.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import * as schema from "../../db/schema.js";

const TEST_SUBDOMAIN = "stream-parity-demo";
const SEED_COLLECTION = "t:stream-parity-demo:students";
const SEED_OBJECT = "t:stream-parity-demo:branding";

async function collectToObject(generator: AsyncGenerator<string, void, unknown>): Promise<unknown> {
  const chunks: string[] = [];
  for await (const chunk of generator) chunks.push(chunk);
  return JSON.parse(chunks.join(""));
}

/** Backend root from this test file (src/__tests__ -> backend). */
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
  // Seed a tenant-scoped collection + object under rls_bypass so RLS allows the write.
  const seedTx = await beginLongLivedTenantTransaction(null);
  try {
    await seedTx.tx.insert(schema.collections).values({
      name: SEED_COLLECTION,
      data: [
        { id: "s-1", name: "Ali" },
        { id: "s-2", name: "Sara" },
      ],
    });
    await seedTx.tx.insert(schema.objects).values({
      key: SEED_OBJECT,
      data: { madrasaName: "Dar ul Quran" },
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
      await cleanupTx.tx
        .delete(schema.collections)
        .where(eq(schema.collections.name, SEED_COLLECTION));
      await cleanupTx.tx.delete(schema.objects).where(eq(schema.objects.key, SEED_OBJECT));
      await cleanupTx.commit();
    } catch {
      await cleanupTx.rollback().catch(() => undefined);
    }
  }
  await closeDatabase();
});

const suite = describe;

suite("real-Postgres streaming snapshot parity", () => {
  it("paged streaming producer yields the same snapshot as the materialized loader", async (ctx) => {
    // Runs only when a real Postgres is reachable; skips otherwise so the normal
    // mocked unit suite stays green without a database.
    if (!dbAvailable) {
      ctx.skip();
      return;
    }
    const materialized = await runWithTenant(TEST_SUBDOMAIN, async () => {
      const data = await getAllData();
      return collectToObject(
        generateSnapshotJsonChunks({
          collections: data.collections,
          objects: data.objects,
        } as never),
      );
    });

    const txn = await beginLongLivedTenantTransaction(TEST_SUBDOMAIN);
    let streamed: unknown;
    try {
      streamed = await collectToObject(
        streamTenantDocStoreSnapshot(txn.tx, { subdomain: TEST_SUBDOMAIN }),
      );
      await txn.commit();
    } catch (error) {
      await txn.rollback().catch(() => undefined);
      throw error;
    }

    expect(streamed).toEqual(materialized);
    expect((streamed as { collections: Record<string, unknown[]> }).collections).toHaveProperty(
      "students",
    );
    expect((streamed as { objects: Record<string, unknown> }).objects).toHaveProperty("branding");
  });

  it("streamed /sync output equals sanitizeSnapshot(fetchDatabaseSnapshot())", async (ctx) => {
    if (!dbAvailable) {
      ctx.skip();
      return;
    }
    const viewer = { id: "viewer", role: "admin" } as never;
    const materialized = await runWithTenant(TEST_SUBDOMAIN, async () => {
      const snap = sanitizeSnapshot(await fetchDatabaseSnapshot(), viewer);
      return collectToObject(generateSnapshotJsonChunks(snap as never));
    });

    const txn = await beginLongLivedTenantTransaction(TEST_SUBDOMAIN);
    let streamed: unknown;
    try {
      streamed = await collectToObject(streamSyncSnapshot(txn, TEST_SUBDOMAIN));
      await txn.commit();
    } catch (error) {
      await txn.rollback().catch(() => undefined);
      throw error;
    }

    expect(streamed).toEqual(materialized);
    expect((streamed as { collections: Record<string, unknown[]> }).collections).toHaveProperty(
      "students",
    );
  });

  it("streamed /backup output equals sanitizeSnapshot(fetchBackupSnapshot())", async (ctx) => {
    if (!dbAvailable) {
      ctx.skip();
      return;
    }
    const viewer = { id: "viewer", role: "admin" } as never;
    const materialized = await runWithTenant(TEST_SUBDOMAIN, async () => {
      const snap = sanitizeSnapshot(await fetchBackupSnapshot(), viewer);
      return collectToObject(generateSnapshotJsonChunks(snap as never));
    });

    const txn = await beginLongLivedTenantTransaction(TEST_SUBDOMAIN);
    let streamed: unknown;
    try {
      streamed = await collectToObject(streamBackupSnapshot(txn, TEST_SUBDOMAIN));
      await txn.commit();
    } catch (error) {
      await txn.rollback().catch(() => undefined);
      throw error;
    }

    expect(streamed).toEqual(materialized);
    // Relational tables are present (empty here) and doc-store students survive.
    expect((streamed as { collections: Record<string, unknown[]> }).collections).toHaveProperty(
      "students",
    );
    expect((streamed as { collections: Record<string, unknown[]> }).collections).toHaveProperty(
      "users",
    );
  });
});
