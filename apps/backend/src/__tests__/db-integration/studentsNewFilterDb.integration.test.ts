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
import { workspaces, students } from "../../db/schema.js";
import { listStudentsPage } from "../../db/repositories/studentRepositoryList.js";
import { buildListConditions } from "../../db/repositories/studentRepositoryListQuery.js";

const TEST_SUBDOMAIN = "stu-new-filter-test";
const RECENT_REGISTERED = "stu-new-registered";
const RECENT_CREATED = "stu-new-created";
const OLD_REGISTERED = "stu-old-registered";
const RECENT_DELETED = "stu-new-deleted";
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

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

let dbAvailable = false;

beforeAll(async () => {
  applyDatabaseUrlFromEnvFile();
  initializeDatabaseConnection();
  dbAvailable = await pingDatabase();
  if (!dbAvailable) return;

  await applyDrizzleMigrations();

  const seedTx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
  try {
    await seedTx.tx
      .insert(workspaces)
      .values({
        id: "ws-stu-new-filter-test",
        subdomain: TEST_SUBDOMAIN,
        madrasaName: "Students New Filter Test Workspace",
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
      await cleanupTx.tx.delete(workspaces).where(eq(workspaces.subdomain, TEST_SUBDOMAIN));
      await cleanupTx.commit();
    } catch {
      await cleanupTx.rollback().catch(() => undefined);
    }
  }
  await closeDatabase();
});

describe("students 'new' quick filter (real Postgres)", () => {
  it("selects recent students by registered date with a created-at fallback", async (ctx) => {
    if (!dbAvailable) {
      ctx.skip();
      return;
    }

    const setupTx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    try {
      await setupTx.tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
      await setupTx.tx.delete(students).where(eq(students.workspaceSubdomain, TEST_SUBDOMAIN));
      await setupTx.tx.insert(students).values([
        {
          id: RECENT_REGISTERED,
          workspaceSubdomain: TEST_SUBDOMAIN,
          status: "active",
          registeredDate: isoDaysAgo(2),
          // Old created_at proves the registered date drives the decision for registered rows.
          createdAt: new Date("2020-01-01T00:00:00.000Z"),
        },
        {
          id: RECENT_CREATED,
          workspaceSubdomain: TEST_SUBDOMAIN,
          status: "active",
          registeredDate: null,
          createdAt: new Date(),
        },
        {
          id: OLD_REGISTERED,
          workspaceSubdomain: TEST_SUBDOMAIN,
          status: "active",
          registeredDate: "2020-01-01",
          createdAt: new Date("2020-01-01T00:00:00.000Z"),
        },
        {
          id: RECENT_DELETED,
          workspaceSubdomain: TEST_SUBDOMAIN,
          status: "active",
          registeredDate: isoDaysAgo(1),
          deletedAt: new Date(),
          deletedBy: "u-admin",
        },
      ]);
      await setupTx.commit();
    } catch (error) {
      await setupTx.rollback().catch(() => undefined);
      throw error;
    }

    const page = await listStudentsPage(TEST_SUBDOMAIN, { quickFilter: "new", page: 1, limit: 50 });
    const ids = page.students.map((student) => String(student.id)).sort();

    expect(ids).toEqual([RECENT_CREATED, RECENT_REGISTERED].sort());
    expect(ids).not.toContain(OLD_REGISTERED);
    expect(ids).not.toContain(RECENT_DELETED);
  });

  it("plans the filter against the existing date indexes instead of a sequential scan", async (ctx) => {
    if (!dbAvailable) {
      ctx.skip();
      return;
    }

    const planTx = await beginLongLivedTenantTransaction(TEST_SUBDOMAIN);
    try {
      await planTx.tx.execute(sql`SET LOCAL enable_seqscan = 'off'`);
      const conditions = buildListConditions(TEST_SUBDOMAIN, { quickFilter: "new" });
      const plan = await planTx.tx.execute(
        sql`EXPLAIN (FORMAT TEXT) SELECT ${students.id} FROM ${students} WHERE ${and(...conditions)}`,
      );
      const text = (plan.rows as Array<Record<string, unknown>>)
        .map((row) => String(Object.values(row)[0] ?? ""))
        .join("\n");

      // An index scan is planned against the tenant workspace index instead of a sequential scan.
      expect(text).toMatch(/(?:Index Scan|Bitmap (?:Index|Heap) Scan) using students_/);
      expect(text).not.toContain("Seq Scan");
      await planTx.commit();
    } catch (error) {
      await planTx.rollback().catch(() => undefined);
      throw error;
    }
  });
});
