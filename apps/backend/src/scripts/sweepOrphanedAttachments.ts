import { closeDatabase, initializeDatabaseConnection } from "../db/dbConnection.js";
import { runAttachmentSweep } from "../services/attachmentSweepService.js";
import { LEADER_LOCK_RETENTION_PURGE, tryAcquireLeaderLease } from "../lib/leaderElection.js";

/**
 * Deletes contact attachment files that no `contact_attachments` row references
 * and that are older than 24 h. Dry-run unless `--apply` is passed (B-03).
 * The nightly retention cycle runs the same sweep with `apply: true`.
 *
 * Run: `pnpm --filter mms-backend purge:orphaned-attachments [--apply]`
 */
async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  initializeDatabaseConnection();
  // Serialise with the nightly retention cycle: two full sweeps must not scan/unlink concurrently.
  const lease = await tryAcquireLeaderLease(LEADER_LOCK_RETENTION_PURGE);
  if (!lease) {
    console.log("[attachments] the nightly retention cycle holds the sweep lease; try again later");
    await closeDatabase();
    return;
  }
  try {
    const result = await runAttachmentSweep({ apply });
    console.log(
      `[attachments] scanned=${result.scanned} referencedKeys=${result.referencedKeys} orphans=${result.orphans} deleted=${result.deleted} apply=${apply}`,
    );
    for (const orphan of result.orphanFiles) {
      console.log(`[attachments] orphan ${orphan.tenant}/${orphan.file}`);
    }
    if (!apply) {
      console.log("[attachments] dry run — pass --apply to delete");
    }
  } finally {
    await lease.release();
    await closeDatabase();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
