import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { SessionSchema, addIsoDays } from "@mms/shared";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import { sessions, workspaces } from "../../db/schema.js";
import { runSessionAutoStart } from "../../worker/sessionLifecycleScheduler.js";
import { saveSession } from "../../db/repositories/sessionRepositoryPersist.js";
import { findSessionById } from "../../db/repositories/sessionRepositoryQueries.js";
import { transitionSession } from "../../sessions/use-cases/sessionTransitionService.js";
import { todayInTimeZone } from "../../lib/dbDate.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TENANT = "session-lifecycle-test";
const TZ_EAST = "session-lifecycle-tz-east";
const TZ_WEST = "session-lifecycle-tz-west";

async function purgeTenant(): Promise<void> {
  for (const tenant of [TENANT, TZ_EAST, TZ_WEST]) {
    await withTenant(tenant, async (tx) => {
      await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
      await tx.execute(sql`DELETE FROM audit_trail_events WHERE workspace_subdomain = ${tenant}`);
      await tx.delete(workspaces).where(eq(workspaces.subdomain, tenant));
    });
  }
}

async function statusOf(id: string, tenant = TENANT): Promise<string | undefined> {
  const rows = await withTenant(tenant, (tx) =>
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
  for (const [tenant, zone] of [
    [TZ_EAST, "Pacific/Kiritimati"],
    [TZ_WEST, "Pacific/Pago_Pago"],
  ] as const) {
    const today = todayInTimeZone(zone);
    await withTenant(tenant, async (tx) => {
      await tx.insert(workspaces).values({
        id: tenant,
        subdomain: tenant,
        madrasaName: tenant,
        enabled: true,
        timezone: zone,
      });
      await tx.insert(sessions).values([
        {
          id: `${tenant}-today`,
          workspaceSubdomain: tenant,
          name: "Today",
          status: "open",
          startDate: today,
        },
        {
          id: `${tenant}-tomorrow`,
          workspaceSubdomain: tenant,
          name: "Tomorrow",
          status: "open",
          startDate: addIsoDays(today, 1),
        },
      ]);
    });
  }
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

  it("executes the complete persisted lifecycle and refuses transitions from archived", async () => {
    await saveSession(
      TENANT,
      SessionSchema.parse({
        id: "lifecycle-full",
        name: "Lifecycle Full",
        status: "draft",
        startDate: "2024-01-01",
        endDate: "2024-06-30",
        overlapExempt: true,
      }),
    );
    const open = await transitionSession(TENANT, "lifecycle-full", { to: "open" });
    expect(open.session.status).toBe("open");
    const active = await transitionSession(TENANT, "lifecycle-full", { to: "in_progress" });
    expect(active.session.status).toBe("in_progress");
    const completed = await transitionSession(TENANT, "lifecycle-full", { to: "completed" });
    expect(completed.session.status).toBe("completed");
    const archived = await transitionSession(TENANT, "lifecycle-full", { to: "archived" });
    expect(archived.session.status).toBe("archived");
    await expect(transitionSession(TENANT, "lifecycle-full", { to: "open" })).rejects.toMatchObject(
      { type: "session_transition_blocked" },
    );
    expect((await findSessionById(TENANT, "lifecycle-full"))?.version).toBe(5);
  });

  it("uses the workspace day at UTC+14 and UTC-11 boundaries", async () => {
    // The first sweep already ran in the preceding test; assert the persisted boundary result.
    await runSessionAutoStart();
    expect(await statusOf(`${TZ_EAST}-today`, TZ_EAST)).toBe("in_progress");
    expect(await statusOf(`${TZ_EAST}-tomorrow`, TZ_EAST)).toBe("open");
    expect(await statusOf(`${TZ_WEST}-today`, TZ_WEST)).toBe("in_progress");
    expect(await statusOf(`${TZ_WEST}-tomorrow`, TZ_WEST)).toBe("open");
  });

  it("accepts a leap-day end date and can complete a session that ends on 29 February", async () => {
    await saveSession(
      TENANT,
      SessionSchema.parse({
        id: "leap-day",
        name: "Leap Day",
        status: "in_progress",
        startDate: "2024-02-01",
        endDate: "2024-02-29",
        overlapExempt: true,
      }),
    );
    const completed = await transitionSession(TENANT, "leap-day", { to: "completed" });
    expect(completed.session.status).toBe("completed");
    expect((await findSessionById(TENANT, "leap-day"))?.endDate).toBe("2024-02-29");
  });
});
