import { loadBackendEnv } from "../config/loadEnv.js";
import { initDb } from "../db/dbInit.js";
import { activeDb, closeDatabase } from "../db/dbConnection.js";
import { workspaces } from "../db/schema/platform.js";
import {
  verifyTenantAuditChain,
  computeAndPublishMerkleCheckpoint,
} from "../services/auditVerificationService.js";

loadBackendEnv();

async function main(): Promise<void> {
  console.log("[verify-audit-chains] Initializing database connection...");
  await initDb();
  const db = activeDb();

  console.log("[verify-audit-chains] Querying active tenant workspaces...");
  const tenantRows = await db.select({ subdomain: workspaces.subdomain }).from(workspaces);

  console.log(
    `[verify-audit-chains] Found ${tenantRows.length} workspace(s). Beginning verification...\n`,
  );

  let anyBroken = false;

  for (const tenant of tenantRows) {
    const res = await verifyTenantAuditChain(tenant.subdomain);
    const statusIcon = res.status === "VERIFIED" ? "✅" : "❌";
    console.log(
      `${statusIcon} Workspace "${tenant.subdomain}": ${res.status} (${res.recordsChecked} records checked, head: ${res.headHash.slice(0, 16)}...)`,
    );

    if (res.discrepancies.length > 0) {
      anyBroken = true;
      for (const disc of res.discrepancies) {
        console.error(`   ⚠️  ${disc}`);
      }
    }
  }

  console.log("\n[verify-audit-chains] Rolling up shard heads into Merkle transparency root...");
  const checkpoint = await computeAndPublishMerkleCheckpoint();
  console.log(`✅ Merkle root checkpoint published:`);
  console.log(`   ID:          ${checkpoint.id}`);
  console.log(`   Root Hash:   ${checkpoint.rootHash}`);
  console.log(`   Shards:      ${checkpoint.shardCount}`);
  console.log(
    `   Period:      ${checkpoint.periodStart.toISOString()} -> ${checkpoint.periodEnd.toISOString()}`,
  );

  await closeDatabase();

  if (anyBroken) {
    console.error("\n❌ Audit trail verification failed with broken or tampered chains.");
    process.exit(1);
  } else {
    console.log("\n✅ All workspace audit chains mathematically verified.");
    process.exit(0);
  }
}

main().catch(async (err) => {
  console.error("Fatal error during audit verification:", err);
  await closeDatabase().catch(() => {});
  process.exit(1);
});
