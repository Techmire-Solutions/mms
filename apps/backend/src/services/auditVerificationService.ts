import crypto from "node:crypto";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import {
  canonicalizeJson,
  formatAuditEventHashInput,
  GENESIS_AUDIT_HASH,
  type AuditVerificationStatus,
} from "@mms/shared";

import { withTenantRead } from "../db/tenant-context.js";
import {
  auditTrailEvents,
  auditVerificationRuns,
  auditMerkleRoots,
} from "../db/schema/auditTrail.js";
import { logger } from "../lib/logger.js";
import type { DbOrTransaction } from "./auditTrailService.js";

export interface ChainVerificationResult {
  runId: string;
  workspaceSubdomain: string;
  status: AuditVerificationStatus;
  recordsChecked: number;
  discrepancies: string[];
  headHash: string;
  anchored: boolean;
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

interface VerificationAnchor {
  toId: number | null;
  toTimestamp: Date | null;
  toHash: string | null;
}

export async function verifyTenantAuditChain(
  workspaceSubdomain: string,
  options?: { limit?: number; executor?: DbOrTransaction },
): Promise<ChainVerificationResult> {
  const subdomain = workspaceSubdomain.trim().toLowerCase();
  const pageSize = Math.max(1, Math.floor(options?.limit ?? 5000));

  const run = async (db: DbOrTransaction): Promise<ChainVerificationResult> => {
    const runId = `ver_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    const anchorRows = await db
      .select({
        toId: auditVerificationRuns.toId,
        toTimestamp: auditVerificationRuns.toTimestamp,
        toHash: auditVerificationRuns.toHash,
      })
      .from(auditVerificationRuns)
      .where(eq(auditVerificationRuns.workspaceSubdomain, subdomain))
      .orderBy(desc(auditVerificationRuns.verifiedAt))
      .limit(1);
    const anchor: VerificationAnchor | null = anchorRows[0]?.toHash ? anchorRows[0] : null;

    let anchorVisible = true;
    if (anchor?.toId) {
      const anchorRow = await db
        .select({ id: auditTrailEvents.id })
        .from(auditTrailEvents)
        .where(
          and(
            eq(auditTrailEvents.workspaceSubdomain, subdomain),
            eq(auditTrailEvents.id, anchor.toId),
          ),
        )
        .limit(1);
      anchorVisible = anchorRow.length > 0;
    }

    const rootRows = await db
      .select({
        heads: auditMerkleRoots.heads,
        periodEnd: auditMerkleRoots.periodEnd,
      })
      .from(auditMerkleRoots)
      .orderBy(desc(auditMerkleRoots.publishedAt))
      .limit(1);
    const publishedHead = rootRows[0]?.heads?.[subdomain] ?? null;

    let expectedPreviousHash = anchor?.toHash ?? GENESIS_AUDIT_HASH;
    const discrepancies: string[] = [];
    let status: AuditVerificationStatus = "VERIFIED";
    let headHash = anchor?.toHash ?? GENESIS_AUDIT_HASH;
    let previousId: number | null = anchor?.toId ?? null;
    let previousTimestamp: Date | null = anchor?.toTimestamp ?? null;
    let totalChecked = 0;
    let sawPublishedHead = false;

    if (!anchorVisible) {
      discrepancies.push(
        `Previous verification anchor #${anchor?.toId} is no longer visible ` +
          "(likely an archived partition); continuing from its last known hash.",
      );
    }

    const verifyEvent = (event: AuditChainEvent): void => {
      headHash = event.hashCurrent;
      previousTimestamp = event.transactionTimestamp;
      if (publishedHead && event.hashCurrent === publishedHead) sawPublishedHead = true;

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
      const hashInput = formatAuditEventHashInput(
        event.hashPrevious,
        canonicalPayload,
        timestampIso,
      );
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

    // Page through the shard chain (keyset on transaction_timestamp, id) so a
    // tampered record past the first page can never be reported as VERIFIED.
    let cursor: { ts: Date; id: number } | null =
      anchor?.toTimestamp && anchor.toId ? { ts: anchor.toTimestamp, id: anchor.toId } : null;
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

    if (publishedHead && !sawPublishedHead && totalChecked > 0) {
      discrepancies.push(
        `Published checkpoint head ${publishedHead} was not found in the verified range.`,
      );
      if (status === "VERIFIED") status = "CHECKPOINT_NOT_IN_CHAIN";
    }

    // 4. Record verification run in append-only table
    await db.insert(auditVerificationRuns).values({
      id: runId,
      workspaceSubdomain: subdomain,
      verifiedAt: new Date(),
      recordsChecked: totalChecked,
      status,
      discrepancies,
      fromId: anchor?.toId ?? null,
      fromTimestamp: anchor?.toTimestamp ?? null,
      fromHash: anchor?.toHash ?? null,
      toId: previousId,
      toTimestamp: previousTimestamp,
      toHash: headHash,
      anchored: anchorVisible,
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
      anchored: anchorVisible,
    };
  };

  if (options?.executor) return run(options.executor);
  return withTenantRead(subdomain, (db) => run(db as unknown as DbOrTransaction));
}

/**
 * Rolls up the latest shard heads across all active tenant workspaces into a Merkle root
 * and publishes the checkpoint (including a per-shard head map) to `audit_merkle_roots`.
 */

export { buildMerkleRoot, computeAndPublishMerkleCheckpoint } from "../lib/auditCheckpoint.js";
export { detectAuditAnomalies, type DetectAnomaliesOptions } from "./auditAnomalyService.js";
