import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { CONTACT_TAG_PRE_MIGRATION_CLEANUP } from "../../db/contactSystemTagsPreMigration.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const tenant = "contacts-pre-migration-review";
const studentOwner = "pre-owner-student";
const staffOwner = "pre-owner-staff";
const studentGuardian = "pre-guardian-student";
const staffParent = "pre-parent-staff";

let client: pg.Client;

beforeAll(async () => {
  await requireDatabaseConnection();
  client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
});

afterAll(async () => {
  await client.end();
});

/**
 * Runs the exported pre-migration statement exactly as production does, against a
 * rolled-back probe tenant. This is the data-level guard for the round-3 N-01
 * regression: non-student relationship owners must keep their manual tags because
 * 0202 never backfills them.
 */
describe("contact system tags pre-migration cleanup (Postgres)", () => {
  it("deletes student-owned relationship tags but preserves non-student owners", async () => {
    await client.query("BEGIN");
    try {
      await client.query("SELECT set_config('app.current_tenant', $1, true)", [tenant]);
      await client.query("SELECT set_config('app.rls_bypass', 'on', true)");

      await client.query(
        `INSERT INTO "workspaces" ("id", "subdomain", "madrasa_name", "enabled")
         VALUES ($1, $1, 'Pre-migration review', true)`,
        [tenant],
      );
      await client.query(
        `INSERT INTO "contacts" ("id", "workspace_subdomain", "first_name", "name")
         VALUES ($1, $2, 'Owner', 'Owner'), ($3, $2, 'Staff', 'Staff'),
                ($4, $2, 'Guardian', 'Guardian'), ($5, $2, 'Parent', 'Parent')`,
        [studentOwner, tenant, staffOwner, studentGuardian, staffParent],
      );
      // Only the student owner has a `students` row: the `students` join is the
      // scope boundary under test.
      await client.query(
        `INSERT INTO "students" ("id", "workspace_subdomain", "contact_id", "status")
         VALUES ($1, $2, $3, 'active')`,
        ["pre-student-row", tenant, studentOwner],
      );
      await client.query(
        `INSERT INTO "contact_relationships"
           ("id", "workspace_subdomain", "contact_id", "related_contact_id", "relationship")
         VALUES ($1, $3, $4, $5, 'Parent'), ($2, $3, $6, $7, 'Parent')`,
        [
          "pre-rel-student",
          "pre-rel-staff",
          tenant,
          studentOwner,
          studentGuardian,
          staffOwner,
          staffParent,
        ],
      );
      await client.query(
        `INSERT INTO "contact_tags" ("id", "workspace_subdomain", "contact_id", "name")
         VALUES ('pre-tag-s1', $1, $2, 'Parent'), ('pre-tag-s2', $1, $2, 'Former Parent'),
                ('pre-tag-n1', $1, $3, 'Parent'), ('pre-tag-n2', $1, $3, 'Former Parent')`,
        [tenant, studentGuardian, staffParent],
      );

      const result = await client.query(CONTACT_TAG_PRE_MIGRATION_CLEANUP.relationshipRoles);
      // The migration runs globally with RLS bypassed; only the probe tenant's
      // rows are asserted. The whole transaction is rolled back.
      expect(result.rowCount).toBeGreaterThanOrEqual(2);

      const remaining = await client.query<{ contact_id: string; count: string }>(
        `SELECT "contact_id", count(*)::text AS count
         FROM "contact_tags"
         WHERE "workspace_subdomain" = $1 AND "contact_id" = ANY($2::text[])
         GROUP BY "contact_id"`,
        [tenant, [studentGuardian, staffParent]],
      );
      const byContact = new Map(remaining.rows.map((row) => [row.contact_id, row.count]));
      expect(byContact.get(studentGuardian)).toBeUndefined();
      expect(byContact.get(staffParent)).toBe("2");
    } finally {
      await client.query("ROLLBACK");
    }
  });
});
