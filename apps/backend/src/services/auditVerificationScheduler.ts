import { activeDb } from "../db/dbConnection.js";
import { workspaces } from "../db/schema/platform.js";
import {
  verifyTenantAuditChain,
  computeAndPublishMerkleCheckpoint,
} from "./auditVerificationService.js";
import {
  countAuditDefaultPartitionRows,
  ensureAuditTrailPartitions,
} from "./auditPartitionService.js";
import { mapWithConcurrency } from "../lib/concurrencyLimiter.js";
import {
  LEADER_LOCK_AUDIT_VERIFICATION,
  tryAcquireLeaderLease,
  type LeaderLease,
} from "../lib/leaderElection.js";

const DEFAULT_VERIFICATION_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Cap on concurrently running per-tenant chain verifications.
 *
 * One verification per tenant in flight at once would consume a pooled DB
 * connection each. With `PG_POOL_MAX` at 20 and the API and worker sharing the
 * connection budget, an unbounded fan-out across a few dozen tenants saturates
 * the pool and stalls ordinary requests until `connectionTimeoutMillis`. This
 * bounds the verifier's share of the pool instead.
 */
const DEFAULT_VERIFICATION_CONCURRENCY = 3;

export interface AuditVerificationSchedulerOptions {
  intervalMs?: number;
  runImmediate?: boolean;
  /** Max per-tenant verifications running at once (default 3). */
  concurrency?: number;
}

/**
 * Section 3 & 6: Automated Cryptographic Verification Scheduler.
 * Periodically verifies shard chains for all active workspaces, alerts on tampering,
 * breaks or sequence gaps, and rolls up latest shard heads into Merkle root checkpoints.
 *
 * Deliberately runs **in the API process, not as a queued worker job**.
 * Tamper-evidence verification is a control that must keep working when the
 * rest of the platform is degraded: a BullMQ job would stop verifying whenever
 * Redis is unavailable, which is exactly when an integrity check matters most.
 * The cost of staying in-process is bounded instead — see
 * `DEFAULT_VERIFICATION_CONCURRENCY`, which caps how much of the shared
 * connection pool the verifier may hold.
 */
export function startAuditVerificationScheduler(
  log: {
    info: (obj: unknown, msg?: string) => void;
    error: (obj: unknown, msg?: string) => void;
    warn: (obj: unknown, msg?: string) => void;
  },
  options?: AuditVerificationSchedulerOptions,
): () => void {
  const intervalMs = options?.intervalMs ?? DEFAULT_VERIFICATION_INTERVAL_MS;
  const concurrency = Math.max(1, options?.concurrency ?? DEFAULT_VERIFICATION_CONCURRENCY);

  // Single-leader election: without it every API replica runs the verifier and
  // publishes a duplicate Merkle checkpoint each interval.
  let leaderLease: LeaderLease | null = null;
  let leadershipLogged = false;

  const ensureLeadership = async (): Promise<boolean> => {
    if (leaderLease?.isHeld()) return true;
    leaderLease = await tryAcquireLeaderLease(LEADER_LOCK_AUDIT_VERIFICATION);
    if (!leaderLease) {
      if (!leadershipLogged) {
        log.info(
          {},
          "Another replica holds the audit verification leader lease; this replica stays passive",
        );
        leadershipLogged = true;
      }
      return false;
    }
    return true;
  };

  const tick = async (): Promise<void> => {
    if (!(await ensureLeadership())) return;

    // Partition maintenance runs first and in its own try/catch: if chain
    // verification or the Merkle rollup throws, monthly provisioning must still
    // happen, or rows would spill into the DEFAULT partition (which then blocks
    // attaching that month's partition).
    await maintainAuditPartitions(log);

    try {
      const db = activeDb();
      const tenants = await db.select({ subdomain: workspaces.subdomain }).from(workspaces);

      // Verify tenant shards with bounded concurrency. Serial verification would
      // leave the pool idle; unbounded fan-out would exhaust it.
      const results = await mapWithConcurrency(
        tenants.map((tenant) => tenant.subdomain),
        concurrency,
        (subdomain) => verifyTenantAuditChain(subdomain),
      );

      for (const result of results) {
        if (result.status === "rejected") {
          log.warn(
            { err: result.reason instanceof Error ? result.reason.message : String(result.reason) },
            "Audit chain verification failed for a tenant shard",
          );
          continue;
        }
        const { value } = result;
        if (value.status !== "VERIFIED") {
          log.error(
            {
              workspaceSubdomain: value.workspaceSubdomain,
              status: value.status,
              discrepanciesCount: value.discrepancies.length,
              discrepancies: value.discrepancies,
            },
            "CRITICAL: Background audit trail verification detected integrity compromise!",
          );
        }
      }

      // Rollup shard heads into Merkle root
      const checkpoint = await computeAndPublishMerkleCheckpoint();
      log.info(
        {
          merkleCheckpointId: checkpoint.id,
          rootHash: checkpoint.rootHash,
          shardCount: checkpoint.shardCount,
        },
        "Merkle transparency root published by scheduled verifier",
      );
    } catch (error) {
      log.warn(
        { err: error instanceof Error ? error.message : String(error) },
        "Audit verification scheduler run failed",
      );
    }
  };

  if (options?.runImmediate) {
    void tick();
  }

  const timer = setInterval(() => {
    void tick();
  }, intervalMs);
  timer.unref?.();

  log.info({ intervalMs, concurrency }, "Audit verification & Merkle root scheduler started");

  return () => {
    clearInterval(timer);
    void leaderLease?.release();
  };
}

/**
 * Keeps the rolling monthly audit partitions provisioned and reports when rows
 * have spilled into the DEFAULT partition (which would block a later attach).
 */
async function maintainAuditPartitions(log: {
  info: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
}): Promise<void> {
  try {
    await ensureAuditTrailPartitions();
    const defaultRows = await countAuditDefaultPartitionRows();
    if (defaultRows > 0) {
      log.error(
        { defaultPartitionRows: defaultRows },
        "audit_trail_events DEFAULT partition is non-empty — monthly provisioning fell " +
          "behind, so these rows cannot be detached by month",
      );
    }
  } catch (error) {
    log.warn(
      { err: error instanceof Error ? error.message : String(error) },
      "Audit partition maintenance failed",
    );
  }
}
