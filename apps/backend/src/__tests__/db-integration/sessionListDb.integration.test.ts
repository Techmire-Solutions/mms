import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { SessionSchema } from "@mms/shared";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import { workspaces } from "../../db/schema.js";
import { saveSession } from "../../db/repositories/sessionRepositoryPersist.js";
import { listSessionsPage } from "../../db/repositories/sessionRepositoryList.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TENANT = "ses-list-test";

async function purgeTenant(): Promise<void> {
  await withTenant(TENANT, async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.delete(workspaces).where(eq(workspaces.subdomain, TENANT));
  });
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await purgeTenant();
  await withTenant(TENANT, async (tx) => {
    await tx
      .insert(workspaces)
      .values({ id: TENANT, subdomain: TENANT, madrasaName: "List test", enabled: true });
  });
  for (const [id, suffix] of [
    ["list-1", "One"],
    ["list-2", "Two"],
    ["list-3", "Three"],
  ] as const) {
    await saveSession(
      TENANT,
      SessionSchema.parse({
        id,
        name: `Session ${suffix}`,
        status: "draft",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        overlapExempt: true,
        classes: [
          {
            id: `${id}-class`,
            name: "Class A",
            sections: [{ id: `${id}-section`, name: "A", capacity: 20 }],
          },
        ],
      }),
    );
  }
});

afterAll(async () => {
  try {
    await purgeTenant();
  } finally {
    await closeDatabase();
  }
});

describe("sessions list repository (real Postgres)", () => {
  it("given view=summary, should skip section hydration", async () => {
    const result = await listSessionsPage(TENANT, { page: 1, limit: 10, view: "summary" });
    expect(result.sessions).toHaveLength(3);
    expect(result.sessions[0]?.classes?.[0]?.sections).toBeUndefined();
  });

  it("given view=full, should hydrate sections", async () => {
    const result = await listSessionsPage(TENANT, { page: 1, limit: 10, view: "full" });
    expect(result.sessions[0]?.classes?.[0]?.sections).toHaveLength(1);
  });

  it("given afterId, should page by id and return nextCursor", async () => {
    const result = await listSessionsPage(TENANT, { page: 1, limit: 1, afterId: "list-1" });
    expect(result.sessions.map((session) => session.id)).toEqual(["list-2"]);
    expect(result.nextCursor).toBe("list-2");
  });

  it("given skipCount, should not run the count query", async () => {
    const result = await listSessionsPage(TENANT, { page: 1, limit: 10, skipCount: true });
    expect(result.total).toBe(0);
    expect(result.hasMore).toBe(false);
  });

  it("given a literal wildcard in search, should not broaden the match", async () => {
    const literal = await listSessionsPage(TENANT, { page: 1, limit: 10, search: "%" });
    const term = await listSessionsPage(TENANT, { page: 1, limit: 10, search: "Session" });
    expect(literal.sessions).toHaveLength(0);
    expect(term.sessions).toHaveLength(3);
  });
});
