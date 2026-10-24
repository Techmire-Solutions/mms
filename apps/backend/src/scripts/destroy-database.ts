import { loadBackendEnv } from "../config/loadEnv.js";
import { getDb } from "../db/dbClient.js";
import { sql } from "drizzle-orm";
import { initDb } from "../db/database.js";

loadBackendEnv();

async function main() {
  console.log("Initializing database connection...");
  await initDb();
  const db = getDb();

  console.log("Completely dropping and recreating public PostgreSQL schema...");
  await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE;`);
  await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE;`);
  await db.execute(sql`CREATE SCHEMA public;`);
  await db.execute(sql`GRANT ALL ON SCHEMA public TO public;`);

  console.log("Re-running clean Drizzle migrations...");
  await initDb();

  console.log("Database successfully reset to 100% clean zero state!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to reset database schema:", err);
  process.exit(1);
});
