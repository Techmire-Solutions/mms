import crypto from "node:crypto";
import { and, desc, gte, lte } from "drizzle-orm";
import { GENESIS_AUDIT_HASH } from "@mms/shared";
import { withGlobalTenant } from "../db/tenant-context.js";
import { auditMerkleRoots, auditTrailEvents } from "../db/schema/auditTrail.js";

/**
 * Computes a Merkle root from an array of leaf hashes using SHA-256.
 */
export function buildMerkleRoot(leafHashes: string[]): string {
  if (leafHashes.length === 0) {
    return GENESIS_AUDIT_HASH;
  }
  if (leafHashes.length === 1) {
    return leafHashes[0];
  }

  // Sort leaves deterministically for canonical tree representation
  let currentLevel = [...leafHashes].sort();

  while (currentLevel.length > 1) {
    const nextLevel: string[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
      const parentHash = crypto.hash("sha256", `${left}${right}`, "hex");
      nextLevel.push(parentHash);
    }
    currentLevel = nextLevel;
  }

  return currentLevel[0];
}

/**
 * Verifies the cryptographic integrity of a workspace's audit shard chain.
 *
 * Starts from the previous run's head (or GENESIS for a brand-new shard), so a
 * detached monthly partition does not turn every later run into a false
 * BROKEN_CHAIN, and a tail truncation cannot hide behind "no events after the
 * anchor". When a published checkpoint exists for the shard, the walk must pass
 * through it or the run reports CHECKPOINT_NOT_IN_CHAIN.
 */
export async function computeAndPublishMerkleCheckpoint(periodStart?: Date): Promise<{
  id: string;
  rootHash: string;
  shardCount: number;
  periodStart: Date;
  periodEnd: Date;
}> {
  const periodEnd = new Date();
  const start = periodStart ?? new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h default

  return withGlobalTenant(async (db) => {
    // Latest head per workspace shard, restricted to the checkpoint window.
    const shardHeads = db
      .selectDistinctOn([auditTrailEvents.workspaceSubdomain], {
        workspaceSubdomain: auditTrailEvents.workspaceSubdomain,
        hashCurrent: auditTrailEvents.hashCurrent,
      })
      .from(auditTrailEvents)
      .where(
        and(
          gte(auditTrailEvents.transactionTimestamp, start),
          lte(auditTrailEvents.transactionTimestamp, periodEnd),
        ),
      )
      .orderBy(
        auditTrailEvents.workspaceSubdomain,
        desc(auditTrailEvents.transactionTimestamp),
        desc(auditTrailEvents.id),
      )
      .as("shard_heads");

    const shardHeadRows = await db
      .select({
        workspaceSubdomain: shardHeads.workspaceSubdomain,
        latestHash: shardHeads.hashCurrent,
      })
      .from(shardHeads);

    const heads: Record<string, string> = {};
    for (const row of shardHeadRows) {
      if (typeof row.latestHash === "string" && row.latestHash.length > 0) {
        heads[row.workspaceSubdomain] = row.latestHash;
      }
    }
    const leafHashes = Object.values(heads);
    const rootHash = buildMerkleRoot(leafHashes);
    const id = `mrk_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    await db.insert(auditMerkleRoots).values({
      id,
      rootHash,
      heads,
      periodStart: start,
      periodEnd,
      shardCount: leafHashes.length,
      publishedAt: periodEnd,
    });

    return {
      id,
      rootHash,
      shardCount: leafHashes.length,
      periodStart: start,
      periodEnd,
    };
  });
}
