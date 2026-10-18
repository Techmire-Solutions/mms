import crypto from "node:crypto";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import {
  canonicalizeJson,
  formatAuditEventHashInput,
  GENESIS_AUDIT_HASH,
  type AuditVerificationStatus,
} from "@mms/shared";

import { activeDb } from "../db/dbConnection.js";
import {
  auditTrailEvents,
  auditVerificationRuns,
  auditMerkleRoots,
} from "../db/schema/auditTrail.js";
import { logger } from "../lib/logger.js";

export interface ChainVerificationResult {
  runId: string;
  workspaceSubdomain: string;
  status: AuditVerificationStatus;
  recordsChecked: number;
  discrepancies: string[];
  headHash: string;
}

/** Projection of an audit event used to recompute the shard hash chain. */
interface AuditChainEvent {
  id: number;
  tableName: string;
  recordId: string;
  actionType: string;
  realUserId: string;
  impersonatedUserId: string | null;
  ipAddress: string | null;
  clientApp: string | null;
  sessionId: string | null;
  correlationId: string;
  apiEndpoint: string | null;
  httpMethod: string | null;
  oldState: string | null;
  newState: string | null;
  hashPrevious: string;
  hashCurrent: string;
  transactionTimestamp: Date;
}

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
 * Checks sequential hash linkage, canonical state reproducibility, and tamper-evidence.
 */
export async function verifyTenantAuditChain(
  workspaceSubdomain: string,
  options?: { limit?: number },
): Promise<ChainVerificationResult> {
  const subdomain = workspaceSubdomain.trim().toLowerCase();
  const runId = `ver_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const pageSize = Math.max(1, Math.floor(options?.limit ?? 5000));
  const db = activeDb();

  let expectedPreviousHash = GENESIS_AUDIT_HASH;
  const discrepancies: string[] = [];
  let status: AuditVerificationStatus = "VERIFIED";
  let headHash = GENESIS_AUDIT_HASH;
  let previousId: number | null = null;
  let totalChecked = 0;

  const verifyEvent = (event: AuditChainEvent): void => {
    headHash = event.hashCurrent;

    // 1. Check for sequence gap and previous hash linkage
    if (previousId !== null && Number(event.id) > previousId + 1) {
      if (event.hashPrevious !== expectedPreviousHash) {
        discrepancies.push(
          `Event #${event.id} (${event.tableName}:${event.recordId}): missing records detected between ID #${previousId} and #${event.id} (sequence gap).`,
        );
        if (status !== "TAMPERED") {
          status = "SEQUENCE_GAP";
        }
      }
    }

    if (event.hashPrevious !== expectedPreviousHash) {
      discrepancies.push(
        `Event #${event.id} (${event.tableName}:${event.recordId}): hash_previous mismatch. Expected ${expectedPreviousHash}, found ${event.hashPrevious}.`,
      );
      if (status !== "TAMPERED" && status !== "SEQUENCE_GAP") {
        status = "BROKEN_CHAIN";
      }
    }

    // 2. Recompute payload canonical JSON
    const payloadForHashing = {
      actionType: event.actionType,
      apiEndpoint: event.apiEndpoint ?? null,
      clientApp: event.clientApp ?? null,
      correlationId: event.correlationId,
      httpMethod: event.httpMethod ?? null,
      impersonatedUserId: event.impersonatedUserId ?? null,
      ipAddress: event.ipAddress ?? null,
      newState: event.newState ?? null,
      oldState: event.oldState ?? null,
      realUserId: event.realUserId,
      recordId: event.recordId,
      sessionId: event.sessionId ?? null,
      tableName: event.tableName,
      workspaceSubdomain: subdomain,
    };

    const canonicalPayload = canonicalizeJson(payloadForHashing);
    const timestampIso = event.transactionTimestamp.toISOString();

    // 3. Recompute expected hash_current
    const hashInput = formatAuditEventHashInput(event.hashPrevious, canonicalPayload, timestampIso);
    const computedHash = crypto.hash("sha256", hashInput, "hex");

    if (event.hashCurrent !== computedHash) {
      discrepancies.push(
        `Event #${event.id} (${event.tableName}:${event.recordId}): hash_current tampered. Computed ${computedHash}, found ${event.hashCurrent}.`,
      );
      status = "TAMPERED";
    }

    expectedPreviousHash = event.hashCurrent;
    previousId = Number(event.id);
  };

  // Page through the entire shard chain (keyset on transaction_timestamp, id) so
  // a tampered record past the first page can never be reported as VERIFIED.
  let cursor: { ts: Date; id: number } | null = null;
  for (;;) {
    const events: AuditChainEvent[] = await db
      .select({
        id: auditTrailEvents.id,
        tableName: auditTrailEvents.tableName,
        recordId: auditTrailEvents.recordId,
        actionType: auditTrailEvents.actionType,
        realUserId: auditTrailEvents.realUserId,
        impersonatedUserId: auditTrailEvents.impersonatedUserId,
        ipAddress: auditTrailEvents.ipAddress,
        clientApp: auditTrailEvents.clientApp,
        sessionId: auditTrailEvents.sessionId,
        correlationId: auditTrailEvents.correlationId,
        apiEndpoint: auditTrailEvents.apiEndpoint,
        httpMethod: auditTrailEvents.httpMethod,
        oldState: auditTrailEvents.oldState,
        newState: auditTrailEvents.newState,
        hashPrevious: auditTrailEvents.hashPrevious,
        hashCurrent: auditTrailEvents.hashCurrent,
        transactionTimestamp: auditTrailEvents.transactionTimestamp,
      })
      .from(auditTrailEvents)
      .where(
        cursor
          ? and(
              eq(auditTrailEvents.workspaceSubdomain, subdomain),
              sql`(${auditTrailEvents.transactionTimestamp}, ${auditTrailEvents.id}) > (${cursor.ts}::timestamptz, ${cursor.id}::bigint)`,
            )
          : eq(auditTrailEvents.workspaceSubdomain, subdomain),
      )
      .orderBy(asc(auditTrailEvents.transactionTimestamp), asc(auditTrailEvents.id))
      .limit(pageSize);

    if (events.length === 0) break;
    for (const event of events) verifyEvent(event);
    totalChecked += events.length;

    const last = events[events.length - 1];
    cursor = { ts: last.transactionTimestamp, id: Number(last.id) };
    if (events.length < pageSize) break;
  }

  // 4. Record verification run in append-only table
  await db.insert(auditVerificationRuns).values({
    id: runId,
    workspaceSubdomain: subdomain,
    verifiedAt: new Date(),
    recordsChecked: totalChecked,
    status,
    discrepancies,
  });

  if (status !== "VERIFIED") {
    logger.error(
      {
        runId,
        workspaceSubdomain: subdomain,
        status,
        discrepanciesCount: discrepancies.length,
      },
      "CRITICAL: Audit trail cryptographic verification failure detected!",
    );
  }

  return {
    runId,
    workspaceSubdomain: subdomain,
    status,
    recordsChecked: totalChecked,
    discrepancies,
    headHash,
  };
}

/**
 * Rolls up the latest shard heads across all active tenant workspaces into a Merkle root
 * and publishes the checkpoint to `audit_merkle_roots` for certificate-transparency scaling.
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
  const db = activeDb();

  // Get chronologically latest hash per workspace shard using DISTINCT ON.
  // MAX(hash_current) is incorrect: SHA-256 hex is NOT alphabetically sortable.
  // NOTE: the outer select must reference the aliased subquery's columns — the
  // previous version selected `auditTrailEvents.*` from the derived table, which
  // PostgreSQL rejects ("missing FROM-clause entry"), so no checkpoint was ever
  // published.
  const shardHeads = db
    .selectDistinctOn([auditTrailEvents.workspaceSubdomain], {
      workspaceSubdomain: auditTrailEvents.workspaceSubdomain,
      hashCurrent: auditTrailEvents.hashCurrent,
    })
    .from(auditTrailEvents)
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

  const leafHashes = shardHeadRows
    .map((h: { workspaceSubdomain: string; latestHash: string | null }) => h.latestHash)
    .filter((hash): hash is string => typeof hash === "string" && hash.length > 0);
  const rootHash = buildMerkleRoot(leafHashes);
  const id = `mrk_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

  await db.insert(auditMerkleRoots).values({
    id,
    rootHash,
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
}

export { detectAuditAnomalies, type DetectAnomaliesOptions } from "./auditAnomalyService.js";
