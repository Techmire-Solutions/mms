import { loadBackendEnv } from "../config/loadEnv.js";
import { initDb } from "../db/dbInit.js";
import { closeDatabase } from "../db/dbConnection.js";
import {
  auditPartitionName,
  countAuditDefaultPartitionRows,
  ensureAuditTrailPartitions,
} from "../services/auditPartitionService.js";

loadBackendEnv();

/**
 * Section 5: Storage & Lifecycle Partition Provisioner.
 * Automatically provisions monthly date partitions for audit_trail_events hot storage.
 * Usage:
 *   pnpm --filter mms-backend tsx src/scripts/create-audit-partition.ts [YYYY-MM]
 * Example:
 *   pnpm --filter mms-backend tsx src/scripts/create-audit-partition.ts 2026-11
 */
async function main(): Promise<void> {
  let targetArg = process.argv[2];
  if (!targetArg) {
    // Default to next month
    const now = new Date();
    const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const y = nextMonth.getUTCFullYear();
    const m = String(nextMonth.getUTCMonth() + 1).padStart(2, "0");
    targetArg = `${y}-${m}`;
  }

  const match = /^(\d{4})-(\d{2})$/.exec(targetArg);
  if (!match) {
    console.error("Usage: tsx src/scripts/create-audit-partition.ts <YYYY-MM>");
    console.error("Example: tsx src/scripts/create-audit-partition.ts 2026-11");
    process.exit(1);
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);

  if (month < 1 || month > 12) {
    console.error("Invalid month. Must be between 01 and 12.");
    process.exit(1);
  }

  console.log(`[create-audit-partition] Initializing database connection...`);
  await initDb();

  // Reuse the shared provisioner so the CLI and the scheduled maintenance path
  // can never diverge on naming or range boundaries.
  const requested = auditPartitionName(year, month);
  console.log(
    `[create-audit-partition] Ensuring "${requested}" exists (also provisions the ` +
      `rolling window ahead of it)...`,
  );
  const { created, existing } = await ensureAuditTrailPartitions();

  console.log(
    `✅ Partitions created: ${created.length > 0 ? created.join(", ") : "(none — already present)"}`,
  );
  if (existing.length > 0) {
    console.log(`   Already present: ${existing.join(", ")}`);
  }

  const defaultRows = await countAuditDefaultPartitionRows();
  if (defaultRows > 0) {
    console.error(
      `⚠️  "audit_trail_events_default" holds ${defaultRows} row(s). Rows in the DEFAULT ` +
        `partition block attaching a new partition for their range. Provision partitions ` +
        `BEFORE the month starts, and migrate these rows out before re-attaching.`,
    );
    process.exitCode = 1;
  }

  await closeDatabase();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("Fatal error during partition creation:", err);
  await closeDatabase().catch(() => {});
  process.exit(1);
});
