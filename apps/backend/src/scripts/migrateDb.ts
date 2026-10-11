import { loadBackendEnv } from "../config/loadEnv.js";
import { closeDatabase } from "../db/dbConnection.js";
import { initDb } from "../db/dbInit.js";
import { disconnectRedis } from "../lib/redis.js";

loadBackendEnv();

async function runMigrations() {
  console.log("[migrateDb] Applying all schema DDL and pending data migrations...");
  await initDb();
  console.log("✅ All schema migrations and data migrations applied successfully!");
  await closeDatabase();
  await disconnectRedis();
}

runMigrations().catch((err) => {
  console.error("✗ Failed to apply database migrations:", err);
  process.exit(1);
});
