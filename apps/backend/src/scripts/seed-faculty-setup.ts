import { loadBackendEnv } from "../config/loadEnv.js";
import { initDb } from "../db/database.js";
import { getDb } from "../db/dbClient.js";
import { facultyDepartments, facultyDesignations } from "../db/schema.js";

loadBackendEnv();

/**
 * Seeds the minimum faculty catalog a fresh tenant needs before a faculty member can be
 * created: one active department and one active designation under it (the Add Faculty
 * Member form requires a designation). Idempotent — safe to run before each faculty create.
 */
async function main() {
  const subdomain = process.argv[2];
  if (!subdomain) {
    console.error("Missing subdomain argument");
    process.exit(1);
  }

  console.log(`Seeding faculty setup (department + designation) for subdomain: "${subdomain}"...`);
  await initDb();
  const db = getDb();

  const departmentId = "dept-default";
  const designationId = "desig-default";

  await db
    .insert(facultyDepartments)
    .values({
      id: departmentId,
      workspaceSubdomain: subdomain,
      name: "General",
      status: "active",
      isActive: true,
    })
    .onConflictDoNothing();

  await db
    .insert(facultyDesignations)
    .values({
      id: designationId,
      workspaceSubdomain: subdomain,
      departmentId,
      name: "Teacher",
      status: "active",
      hierarchyRank: 1,
      isActive: true,
    })
    .onConflictDoNothing();

  console.log("Faculty setup seeded successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
