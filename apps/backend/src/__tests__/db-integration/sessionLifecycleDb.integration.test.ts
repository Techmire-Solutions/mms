import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import { sessions, workspaces } from "../../db/schema.js";
import { runSessionAutoStart } from "../../worker/sessionLifecycleScheduler.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TENANT = "session-lifecycle-test";

async function purgeTenant(): Promise<void> {
  await withTenant(TENANT, async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.delete(workspaces).where(eq(workspaces.subdomain, TENANT));
  });
}

async function statusOf(id: string): Promise<string | undefined> {
  const rows = await withTenant(TENANT, (tx) =>
    tx.select({ status: sessions.status }).from(sessions).where(eq(sessions.id, id)),
  );
  return rows[0]?.status;
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await purgeTenant();
  await withTenant(TENANT, async (tx) => {
    await tx.insert(workspaces).values({
      id: TENANT,
      subdomain: TENANT,
      madrasaName: "Lifecycle test",
      enabled: true,
      timezone: "Not/AZone",
    });
    await tx.insert(sessions).values([
      {
        id: "due",
        workspaceSubdomain: TENANT,
        name: "Due",
        status: "open",
        startDate: "2020-01-01",
      },
      {
        id: "future",
        workspaceSubdomain: TENANT,
        name: "Future",
        status: "open",
        startDate: "2999-01-01",
      },
      {
        id: "no-date",
        workspaceSubdomain: TENANT,
        name: "Undated",
        status: "open",
        startDate: null,
      },
      { id: "drafted", workspaceSubdomain: TENANT, name: "Draft", startDate: "2020-01-01" },
    ]);
  });
});

afterAll(async () => {
  try {
    await purgeTenant();
  } finally {
    await closeDatabase();
  }
});

describe("session lifecycle (real Postgres)", () => {
  it("given a non-lifecycle status, should reject it via the check constraint", async () => {
    // Act
    const write = withTenant(TENANT, (tx) =>
      tx.update(sessions).set({ status: "active" }).where(eq(sessions.id, "due")),
    );

    // Assert
    await expect(write).rejects.toThrow();
  });

  it("given open sessions, should auto-start only those whose start date has arrived (unknown timezone falls back to UTC)", async () => {
    // Act
    const started = await runSessionAutoStart();

    // Assert
    expect(started.filter((row) => row.workspace === TENANT).map((row) => row.id)).toEqual(["due"]);
    expect(await statusOf("due")).toBe("in_progress");
    expect(await statusOf("future")).toBe("open");
    expect(await statusOf("no-date")).toBe("open");
    expect(await statusOf("drafted")).toBe("draft");
  });
});
