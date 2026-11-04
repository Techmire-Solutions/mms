import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  beginLongLivedTenantTransaction,
  closeDatabase,
  initializeDatabaseConnection,
  pingDatabase,
} from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { messageLogs, workspaces } from "../../db/schema.js";
import {
  claimMessageLogForDelivery,
  saveMessageLogDeliveryOutcomes,
  softDeleteActiveMessageLogs,
} from "../../db/repositories/messagingLogsMutationRepository.js";
import {
  queryFilteredMessageLogs,
  queryMessagingMetrics,
} from "../../db/repositories/messagingLogsQueryRepository.js";
import { listAllMessageLogsByWorkspace } from "../../db/repositories/messagingLogsRepository.js";

const TEST_SUBDOMAIN = "messaging-review-test";
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

function claim(id: string, channel: string, sentAt: string) {
  return {
    id,
    userId: "u-admin",
    contactId: `c-${id}`,
    channel,
    body: `Body for ${id}`,
    sentAt,
    category: "general",
  };
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
        id: "ws-messaging-review-test",
        subdomain: TEST_SUBDOMAIN,
        madrasaName: "Messaging Review Test Workspace",
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
      await cleanupTx.tx
        .delete(messageLogs)
        .where(eq(messageLogs.workspaceSubdomain, TEST_SUBDOMAIN));
      await cleanupTx.tx.delete(workspaces).where(eq(workspaces.subdomain, TEST_SUBDOMAIN));
      await cleanupTx.commit();
    } catch {
      await cleanupTx.rollback().catch(() => undefined);
    }
  }
  await closeDatabase();
});

describe("messaging logs against real PostgreSQL", () => {
  it("claims as `sending`, counts it in the queue bucket, then batches outcomes", async (ctx) => {
    if (!dbAvailable) {
      ctx.skip();
      return;
    }

    const first = claim("log-claim-1", "sms", "2026-11-04T10:00:00.000Z");
    const second = claim("log-claim-2", "sms", "2026-11-04T10:01:00.000Z");

    await expect(claimMessageLogForDelivery(TEST_SUBDOMAIN, first)).resolves.toBe(true);
    await expect(claimMessageLogForDelivery(TEST_SUBDOMAIN, second)).resolves.toBe(true);
    // A second claim of the same recipient is not re-sent.
    await expect(claimMessageLogForDelivery(TEST_SUBDOMAIN, first)).resolves.toBe(false);

    const inFlight = await queryMessagingMetrics(TEST_SUBDOMAIN, {});
    expect(inFlight.total).toBe(2);
    expect(inFlight.queuedCount).toBe(2);
    expect(inFlight.sentCount).toBe(0);
    // Queued rows have no outcome yet: the rate must not read as 0% failure.
    expect(inFlight.successRate).toBe(100);

    await saveMessageLogDeliveryOutcomes(TEST_SUBDOMAIN, [
      { ...first, status: "sent", errorMessage: null },
      { ...second, status: "failed", errorMessage: "Gateway rejected dispatch" },
    ]);

    const settled = await queryMessagingMetrics(TEST_SUBDOMAIN, {});
    expect(settled.queuedCount).toBe(0);
    expect(settled.sentCount).toBe(1);
    expect(settled.failedCount).toBe(1);
    // Attempted = sent + failed (2), successful = 1.
    expect(settled.successRate).toBe(50);

    const third = claim("log-claim-3", "sms", "2026-11-04T10:02:00.000Z");
    await claimMessageLogForDelivery(TEST_SUBDOMAIN, third);
    await saveMessageLogDeliveryOutcomes(TEST_SUBDOMAIN, [
      { ...third, status: "failed", errorMessage: "Gateway rejected dispatch" },
    ]);
    // A skipped row (recipient had no address on file) is inserted directly:
    // delivery outcomes only model sent/failed.
    const skipTx = await beginLongLivedTenantTransaction(TEST_SUBDOMAIN);
    try {
      await skipTx.tx.insert(messageLogs).values({
        id: "log-skipped-1",
        workspaceSubdomain: TEST_SUBDOMAIN,
        userId: "u-admin",
        contactId: "c-skipped",
        channel: "sms",
        body: "Skipped body",
        sentAt: "2026-11-05T10:05:00.000Z",
        status: "skipped",
        category: "general",
      });
      await skipTx.commit();
    } catch (error) {
      await skipTx.rollback().catch(() => undefined);
      throw error;
    }
    const withSkipped = await queryMessagingMetrics(TEST_SUBDOMAIN, {});
    // Attempted = 3 settled rows (1 successful) — the skipped row is not an
    // attempt and must not dilute the rate.
    expect(withSkipped.skippedCount).toBe(1);
    expect(withSkipped.successRate).toBe(33);

    const page = await queryFilteredMessageLogs(TEST_SUBDOMAIN, { search: "log-claim-2" });
    expect(page.logs[0]?.errorMessage).toBe("Gateway rejected dispatch");
  });

  it("honours the sort allowlist and direction", async (ctx) => {
    if (!dbAvailable) {
      ctx.skip();
      return;
    }

    await claimMessageLogForDelivery(
      TEST_SUBDOMAIN,
      claim("log-sort-a", "whatsapp", "2026-11-04T11:00:00.000Z"),
    );
    await claimMessageLogForDelivery(
      TEST_SUBDOMAIN,
      claim("log-sort-b", "email", "2026-11-04T11:00:01.000Z"),
    );

    const ascending = await queryFilteredMessageLogs(TEST_SUBDOMAIN, {
      sortField: "channel",
      sortDir: "asc",
    });
    const channels = ascending.logs.map((log) => log.channel);
    expect(channels).toEqual([...channels].sort());
    expect(channels[0]).toBe("email");

    // An unknown field falls back to the default (`sentAt desc`) instead of throwing.
    const fallback = await queryFilteredMessageLogs(TEST_SUBDOMAIN, {
      sortField: "body; DROP TABLE message_logs",
    });
    expect(fallback.logs.length).toBeGreaterThan(0);
  });

  it("stamps the clearing actor and hides archived rows from the active view", async (ctx) => {
    if (!dbAvailable) {
      ctx.skip();
      return;
    }

    await softDeleteActiveMessageLogs(TEST_SUBDOMAIN, "u-admin");

    const active = await queryFilteredMessageLogs(TEST_SUBDOMAIN, {});
    expect(active.logs).toHaveLength(0);

    const archived = await queryFilteredMessageLogs(TEST_SUBDOMAIN, { includeDeleted: true });
    expect(archived.logs.length).toBeGreaterThan(0);
    expect(archived.logs.every((log) => log.deletedBy === "u-admin")).toBe(true);
    expect(archived.logs.every((log) => log.deletionReason === "messaging.logs.clear")).toBe(true);
  });

  it("includes archived rows in the backup snapshot with their attribution", async (ctx) => {
    if (!dbAvailable) {
      ctx.skip();
      return;
    }

    // Runs after the archive test: every row is currently soft-archived.
    const snapshot = await listAllMessageLogsByWorkspace(TEST_SUBDOMAIN, {
      limit: 250,
      offset: 0,
    });

    expect(snapshot.length).toBeGreaterThan(0);
    expect(snapshot.some((log) => Boolean(log.deletedAt))).toBe(true);
    expect(snapshot.every((log) => (log.deletedAt ? log.deletedBy === "u-admin" : true))).toBe(
      true,
    );
    // Stable paging key for the streamed backup.
    const ids = snapshot.map((log) => log.id);
    expect(ids).toEqual([...ids].sort());
  });
});
