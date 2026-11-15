import { loadBackendEnv } from "../config/loadEnv.js";
import { getPool, closeDatabase, initializeDatabaseConnection } from "../db/dbConnection.js";
import { resolveMigrationsFolder } from "../db/dbInit.js";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

loadBackendEnv();

interface DrizzleMigrationRecord {
  id: number;
  hash: string;
  created_at: number;
}

interface DataMigrationRecord {
  id: string;
  applied_at: Date;
}

async function checkMigrations() {
  initializeDatabaseConnection();
  const pool = getPool();
  try {
    console.log("--- Checking Drizzle Schema Migrations ---");
    const drizzleResult = await pool.query<DrizzleMigrationRecord>(
      "SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id ASC",
    );
    const appliedDrizzle = drizzleResult.rows;

    const migrationsFolder = resolveMigrationsFolder();
    const journalPath = join(migrationsFolder, "meta", "_journal.json");
    if (existsSync(journalPath)) {
      const journal = JSON.parse(readFileSync(journalPath, "utf-8"));
      const entries = journal.entries || [];
      console.log(`Journal migrations count: ${entries.length}`);
      console.log(`Applied Drizzle migrations count: ${appliedDrizzle.length}`);

      const appliedCreatedAt = new Set(
        appliedDrizzle.map((a: { created_at: string | number }) => String(a.created_at)),
      );
      const unapplied = entries.filter(
        (e: { when: number }) => !appliedCreatedAt.has(String(e.when)),
      );

      if (unapplied.length > 0) {
        console.warn(
          "⚠️ Pending Drizzle migrations:",
          unapplied.map((u: { tag: string }) => u.tag),
        );
      } else {
        console.log(
          `✅ All ${entries.length} Drizzle migrations from journal are applied in database.`,
        );
      }
    } else {
      console.log(`Journal not found at ${journalPath}`);
    }

    console.log("\n--- Checking Data Migrations ---");
    const dataResult = await pool.query<DataMigrationRecord>(
      "SELECT id, applied_at FROM data_migrations ORDER BY id ASC",
    );
    console.log(`Applied data migrations count: ${dataResult.rows.length}`);
    const latestData = dataResult.rows.slice(-5);
    console.log(
      "Recent applied data migrations:",
      latestData.map((d) => d.id),
    );

    console.log("\n--- Checking Faculty Domain Tables & Columns ---");
    const tables = [
      "faculty_departments",
      "faculty_designations",
      "faculty_employments",
      "faculty",
      "faculty_employ_designations",
      "faculty_assignments",
    ];
    for (const t of tables) {
      const colRes = await pool.query<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position",
        [t],
      );
      const countRes = await pool.query<{ count: string }>(`SELECT count(*) FROM "${t}"`);
      const rowCount = countRes.rows[0]?.count ?? "0";
      console.log(`✓ Table "${t}": ${colRes.rows.length} columns, ${rowCount} rows`);
    }

    const sampleFaculty = await pool.query(`
      SELECT f.id, f.employment_id, fe.contact_id, fe.employee_id, f.profile_status, fe.status AS employment_status
      FROM faculty f
      LEFT JOIN faculty_employments fe ON fe.id = f.employment_id
      LIMIT 3
    `);
    console.log("\nSample faculty records:");
    console.table(sampleFaculty.rows);

    console.log("\n--- Migration Check Complete ---");
  } catch (error) {
    console.error("Failed to check migrations:", error);
  } finally {
    await closeDatabase();
  }
}

checkMigrations().catch((err) => {
  console.error(err);
  process.exit(1);
});
