import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";
import {
  seedFacultyHierarchy,
  cleanupFacultyHierarchy,
  facultyTestTenant as tenant,
} from "./facultyHierarchyFixtures.js";

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await seedFacultyHierarchy();
});
afterAll(async () => {
  await cleanupFacultyHierarchy();
  await closeDatabase();
});

describe("Faculty legacy backfill", () => {
  it("rejects multiple active faculty profiles for the same contact in a workspace", async () => {
    await expect(
      withTenant(tenant, (tx) =>
        tx.execute(sql`
      INSERT INTO faculty (id, workspace_subdomain, contact_id) VALUES ('duplicate', ${tenant}, 'c0')
    `),
      ),
    ).rejects.toThrow();
  });
  it.skip("legacy denormalized faculty backfill removed after migration 0146", () => {});

  it("blocks hard-delete of faculty assignments while forbid_hard_delete is active", async () => {
    await expect(
      withTenant(tenant, (tx) =>
        tx.execute(sql`
      DELETE FROM faculty_assignments WHERE workspace_subdomain = ${tenant} AND id = 'a24'
    `),
      ),
    ).rejects.toThrow();
  });
});
