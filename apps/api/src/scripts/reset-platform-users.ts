import { loadBackendEnv } from "../config/loadEnv.js";
import { initializeDatabase } from "../bootstrap/initializeDatabase.js";
import { getDb } from "@mms/db/client";
import { platformUsers } from "@mms/db/schema";

loadBackendEnv();

async function main() {
  await initializeDatabase();
  const db = getDb();
  await db.delete(platformUsers);
  console.log("Successfully cleared platform users for E2E testing.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
