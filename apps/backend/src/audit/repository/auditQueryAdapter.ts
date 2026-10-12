import { and, desc, eq, sql } from "drizzle-orm";
import type { ListAuditEventsQuery } from "@mms/shared";
import { activeDb } from "../../db/dbConnection.js";
import {
  auditMerkleRoots,
  auditTrailEvents,
  auditVerificationRuns,
} from "../../db/schema/auditTrail.js";

/**
 * Drizzle-backed read queries for the tenant audit trail. The only file in the audit
 * domain that touches `drizzle-orm` / `activeDb()` / `db/schema`.
 */

/** Paginated audit-event listing with an explicit projection (no heavy raw state on listings). */
export async function listAuditEvents(tenant: string, query: ListAuditEventsQuery) {
  const conditions = [eq(auditTrailEvents.workspaceSubdomain, tenant)];
  if (query.tableName) {
    conditions.push(eq(auditTrailEvents.tableName, query.tableName));
  }
  if (query.recordId) {
    conditions.push(eq(auditTrailEvents.recordId, query.recordId));
  }
  if (query.actionType) {
    conditions.push(eq(auditTrailEvents.actionType, query.actionType));
  }

  const db = activeDb();
  const [items, countResult] = await Promise.all([
    db
      .select({
        id: auditTrailEvents.id,
        workspaceSubdomain: auditTrailEvents.workspaceSubdomain,
        tableName: auditTrailEvents.tableName,
        recordId: auditTrailEvents.recordId,
        actionType: auditTrailEvents.actionType,
        realUserId: auditTrailEvents.realUserId,
        impersonatedUserId: auditTrailEvents.impersonatedUserId,
        ipAddress: auditTrailEvents.ipAddress,
        clientApp: auditTrailEvents.clientApp,
        correlationId: auditTrailEvents.correlationId,
        hashPrevious: auditTrailEvents.hashPrevious,
        hashCurrent: auditTrailEvents.hashCurrent,
        verificationStatus: auditTrailEvents.verificationStatus,
        transactionTimestamp: auditTrailEvents.transactionTimestamp,
      })
      .from(auditTrailEvents)
      .where(and(...conditions))
      .orderBy(desc(auditTrailEvents.transactionTimestamp), desc(auditTrailEvents.id))
      .limit(query.limit)
      .offset(query.offset),
    db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(auditTrailEvents)
      .where(and(...conditions)),
  ]);

  return { items, total: countResult[0]?.count ?? 0 };
}

/** Full-projection export of the most recent audit events for the shard. */
export async function listAuditEventsForExport(tenant: string, limit = 1000) {
  return activeDb()
    .select({
      id: auditTrailEvents.id,
      workspaceSubdomain: auditTrailEvents.workspaceSubdomain,
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
      verificationStatus: auditTrailEvents.verificationStatus,
      transactionTimestamp: auditTrailEvents.transactionTimestamp,
    })
    .from(auditTrailEvents)
    .where(eq(auditTrailEvents.workspaceSubdomain, tenant))
    .orderBy(desc(auditTrailEvents.transactionTimestamp))
    .limit(limit);
}

/** Most recent verification run for the shard, or null when none has been recorded. */
export async function getLatestVerificationRun(tenant: string) {
  const rows = await activeDb()
    .select({
      id: auditVerificationRuns.id,
      status: auditVerificationRuns.status,
      verifiedAt: auditVerificationRuns.verifiedAt,
      recordsChecked: auditVerificationRuns.recordsChecked,
      discrepancies: auditVerificationRuns.discrepancies,
    })
    .from(auditVerificationRuns)
    .where(eq(auditVerificationRuns.workspaceSubdomain, tenant))
    .orderBy(desc(auditVerificationRuns.verifiedAt))
    .limit(1);

  return rows[0] ?? null;
}

/** Most recently published Merkle transparency checkpoints. */
export async function listMerkleRoots(limit = 20) {
  return activeDb()
    .select({
      id: auditMerkleRoots.id,
      rootHash: auditMerkleRoots.rootHash,
      periodStart: auditMerkleRoots.periodStart,
      periodEnd: auditMerkleRoots.periodEnd,
      shardCount: auditMerkleRoots.shardCount,
      publishedAt: auditMerkleRoots.publishedAt,
    })
    .from(auditMerkleRoots)
    .orderBy(desc(auditMerkleRoots.publishedAt))
    .limit(limit);
}
