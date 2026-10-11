import pg from "pg";
import { loadBackendEnv } from "../config/loadEnv.js";
import { initDb, closeDatabase } from "../db/database.js";

import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

loadBackendEnv();

async function resetAndRecreateDb() {
  const isTest = process.env.NODE_ENV === "test";
  const isNonInteractive = !input.isTTY;
  const hasForceFlag = process.argv.includes("--confirm") || process.argv.includes("--force");

  if (!isTest && !isNonInteractive && !hasForceFlag) {
    const rl = readline.createInterface({ input, output });
    try {
      const answer = await rl.question(
        "⚠️  WARNING: This script will drop ALL tables, views, and delete ALL data in the database. Are you sure you want to proceed? (yes/no): ",
      );
      if (answer.trim().toLowerCase() !== "yes") {
        console.log("Database reset aborted.");
        process.exit(0);
      }
    } finally {
      rl.close();
    }
  }
  const connectionString =
    process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/mms";
  console.log("[1/2] Clearing database objects...");
  const pool = new pg.Pool({ connectionString });
  const client = await pool.connect();

  await using _dbDisposer = {
    [Symbol.asyncDispose]: async () => {
      client.release();
      await pool.end();
    },
  };

  // Drop views, tables, and enums individually (privilege-safe) — mirrors platformDatabaseService.ts
  await client.query(`
    DO $$ DECLARE
        r RECORD;
    BEGIN
        FOR r IN (SELECT viewname FROM pg_views WHERE schemaname = 'public') LOOP
            EXECUTE 'DROP VIEW IF EXISTS public.' || quote_ident(r.viewname) || ' CASCADE';
        END LOOP;

        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
            EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;

        FOR r IN (
            SELECT typname
            FROM pg_type t
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'public'
              AND t.typtype = 'e'
        ) LOOP
            EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
        END LOOP;
    END $$;
  `);
  await client.query("DROP SCHEMA IF EXISTS drizzle CASCADE;");
  console.log("[1/2] All objects cleared.");

  console.log("[2/2] Applying SQL migrations, data migrations, and seeding...");
  await initDb();
  console.log("🎉 Local database successfully recreated and seeded!");
  await closeDatabase();
}

resetAndRecreateDb().catch((err) => {
  console.error("Failed to reset and recreate local database:", err);
  process.exit(1);
});
