import { sql } from "drizzle-orm";
import { loadBackendEnv } from "../config/loadEnv.js";
import { initDb } from "../db/dbInit.js";
import { activeDb, closeDatabase } from "../db/dbConnection.js";
import { computeAndPublishMerkleCheckpoint } from "../services/auditVerificationService.js";

loadBackendEnv();

async function main(): Promise<void> {
  const targetPartition = process.argv[2];
  if (!targetPartition) {
    console.error("Usage: tsx src/scripts/detach-audit-partition.ts <partition_table_name>");
    console.error("Example: tsx src/scripts/detach-audit-partition.ts audit_trail_events_y2026m06");
    process.exit(1);
  }

  // Validate partition table name strictly against SQL injection
  if (!/^audit_trail_events_y\d{4}m\d{2}$/.test(targetPartition)) {
    console.error("Invalid partition name format. Expected: audit_trail_events_y<YYYY>m<MM>");
    process.exit(1);
  }

  console.log(`[detach-audit-partition] Initializing database connection...`);
  await initDb();
  const db = activeDb();

  console.log(
    `[detach-audit-partition] Publishing final Merkle root rollup before partition detachment...`,
  );
  const checkpoint = await computeAndPublishMerkleCheckpoint();
  console.log(`✅ Pre-detachment Merkle root published: ${checkpoint.rootHash}`);

  console.log(
    `[detach-audit-partition] Executing zero-downtime partition detachment: "${targetPartition}"...`,
  );
  await db.execute(sql.raw(`ALTER TABLE audit_trail_events DETACH PARTITION ${targetPartition};`));
  console.log(`✅ Successfully detached "${targetPartition}".`);
  console.log(
    `\nArchival Manifest Metadata (to carry into WORM S3 cold storage alongside Parquet dump):`,
  );
  console.log(
    JSON.stringify(
      {
        partition: targetPartition,
        detachedAt: new Date().toISOString(),
        finalMerkleRoot: checkpoint.rootHash,
        merkleCheckpointId: checkpoint.id,
        storageTierTarget: "COLD_WORM_S3_OBJECT_LOCK",
      },
      null,
      2,
    ),
  );

  await closeDatabase();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("Fatal error during partition detachment:", err);
  await closeDatabase().catch(() => {});
  process.exit(1);
});
