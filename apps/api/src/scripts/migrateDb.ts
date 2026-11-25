import "../config/preloadEnv.js";
import { closeDatabase } from "@mms/db/client";
import { initializeDatabase } from "../bootstrap/initializeDatabase.js";
import { configureModuleAdapters } from "../bootstrap/configureModuleAdapters.js";
import { disconnectRedis } from "../lib/redis.js";

configureModuleAdapters();

async function runMigrations() {
  console.log("[migrateDb] Applying all schema DDL and pending data migrations...");
  await initializeDatabase();
  console.log("✅ All schema migrations and data migrations applied successfully!");
  await closeDatabase();
  await disconnectRedis();
}

runMigrations().catch((err) => {
  console.error("✗ Failed to apply database migrations:", err);
  process.exit(1);
});
