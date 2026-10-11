import { loadBackendEnv } from "../config/loadEnv.js";
import { initDb } from "../db/database.js";
import { getDb } from "../db/dbClient.js";
import { platformUsers } from "../db/schema.js";

loadBackendEnv();

async function main() {
  await initDb();
  const db = getDb();
  await db.delete(platformUsers);
  console.log("Successfully cleared platform users for E2E testing.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
