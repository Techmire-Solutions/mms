import { loadBackendEnv } from "../config/loadEnv.js";
import { initDb } from "../db/database.js";
import { getDb } from "../db/dbClient.js";
import { workspaces, sessions } from "../db/schema.js";

loadBackendEnv();

/**
 * Seeds 20 deterministic academic sessions into a tenant so the a11y gate can audit a *populated*
 * sessions Work table — the empty-tenant blind spot in `docs/a11y-baseline.md`. Idempotent
 * (`onConflictDoNothing` on the fixed ids), so re-running cannot duplicate rows. Self-contained:
 * the `sessions` table has no contact/faculty FK, so no other seed needs to run first.
 */
const SESSION_COUNT = 20;

async function main() {
  await initDb();
  const db = getDb();

  const argSubdomain = process.argv[2]?.trim().toLowerCase();
  let subdomainsToSeed: string[];

  if (argSubdomain && argSubdomain !== "all") {
    subdomainsToSeed = [argSubdomain];
  } else {
    const allWorkspaces = await db.select({ subdomain: workspaces.subdomain }).from(workspaces);
    subdomainsToSeed = Array.from(new Set(allWorkspaces.map((w) => w.subdomain)));
  }

  for (const subdomain of subdomainsToSeed) {
    console.log(`Seeding ${SESSION_COUNT} dummy sessions for tenant subdomain: "${subdomain}"...`);

    const rows = Array.from({ length: SESSION_COUNT }, (_, index) => {
      const n = index + 1;
      return {
        id: `sess-seed-${n}`,
        workspaceSubdomain: subdomain,
        name: `Seeded Session ${String(n).padStart(2, "0")}`,
        type: "academic",
        status: "in_progress",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        baseFee: String(1000 + n),
        currency: "PKR",
        description: `Seeded session ${n} for the populated a11y sweep.`,
      };
    });

    await db.insert(sessions).values(rows).onConflictDoNothing();
    console.log(`Successfully seeded ${SESSION_COUNT} sessions into workspace "${subdomain}"!`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to seed sessions:", err);
  process.exit(1);
});
