/**
 * DANGER: Wipes the ENTIRE application database (all schemas), not platform tables only.
 *
 * Drops `public` + `drizzle`, recreates `public`, then runs `initDb()` migrations.
 * Prefer `resetDb.ts` (`pnpm --filter mms-backend db:reset`) which prompts for confirmation.
 *
 * Usage (local/dev only):
 *   pnpm --filter mms-backend exec tsx src/scripts/reset-app-db.ts
 */
import { loadBackendEnv } from "../config/loadEnv.js";
import pg from "pg";
import { initDb } from "../db/database.js";

loadBackendEnv();

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log(
    "WARNING: Dropping public and drizzle schemas — ALL app + platform data will be lost.",
  );
  await client.query("DROP SCHEMA IF EXISTS public CASCADE;");
  await client.query("DROP SCHEMA IF EXISTS drizzle CASCADE;");
  await client.query("CREATE SCHEMA public;");
  await client.query("GRANT ALL ON SCHEMA public TO public;");
  await client.end();

  console.log("Running clean database initialization & migrations...");
  await initDb();

  console.log("Database completely wiped and reset to initial migrated state.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to reset database:", err);
  process.exit(1);
});
