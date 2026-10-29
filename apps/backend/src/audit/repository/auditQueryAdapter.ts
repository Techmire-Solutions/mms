import { and, desc, eq, sql } from "drizzle-orm";
import type { ListAuditEventsQuery } from "@mms/shared";
import { withGlobalTenant, withTenantRead } from "../../db/tenant-context.js";
import {
  auditMerkleRoots,
  auditTrailEvents,
  auditVerificationRuns,
} from "../../db/schema/auditTrail.js";
import { decryptSubjectAuditState, isEncryptedSubjectState } from "../../lib/subjectKeyService.js";

/**
 * Drizzle-backed read queries for the tenant audit trail. Every read runs inside
 * a tenant transaction so `FORCE ROW LEVEL SECURITY` can see the shard.
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

  return withTenantRead(tenant, async (db) => {
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
  });
}

/** Full-projection export of the most recent audit events for the shard. */
export async function listAuditEventsForExport(tenant: string, limit = 1000) {
  // Decryption must run inside the tenant transaction: subject keys live in a
  // FORCE-RLS table, and `decryptSubjectAuditState` resolves them through
  // `activeDb()`. Decrypting after the callback committed used to read through
  // the root pool with no tenant GUC, which rendered every encrypted state as
  // `[DATA_SHREDDED]`.
  return withTenantRead(tenant, async (db) => {
    const rows = await db
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

    return Promise.all(
      rows.map(async (row) => ({
        ...row,
        oldState: isEncryptedSubjectState(row.oldState)
          ? await decryptSubjectAuditState(tenant, row.oldState)
          : row.oldState,
        newState: isEncryptedSubjectState(row.newState)
          ? await decryptSubjectAuditState(tenant, row.newState)
          : row.newState,
      })),
    );
  });
}

/** Most recent verification run for the shard, or null when none has been recorded. */
export async function getLatestVerificationRun(tenant: string) {
  return withTenantRead(tenant, async (db) => {
    const rows = await db
      .select({
        id: auditVerificationRuns.id,
        status: auditVerificationRuns.status,
        verifiedAt: auditVerificationRuns.verifiedAt,
        recordsChecked: auditVerificationRuns.recordsChecked,
        discrepancies: auditVerificationRuns.discrepancies,
        fromId: auditVerificationRuns.fromId,
        fromTimestamp: auditVerificationRuns.fromTimestamp,
        fromHash: auditVerificationRuns.fromHash,
        toId: auditVerificationRuns.toId,
        toTimestamp: auditVerificationRuns.toTimestamp,
        toHash: auditVerificationRuns.toHash,
        anchored: auditVerificationRuns.anchored,
      })
      .from(auditVerificationRuns)
      .where(eq(auditVerificationRuns.workspaceSubdomain, tenant))
      .orderBy(desc(auditVerificationRuns.verifiedAt))
      .limit(1);

    return rows[0] ?? null;
  });
}

export interface TenantMerkleHead {
  id: string;
  rootHash: string;
  headHash: string | null;
  periodStart: Date;
  periodEnd: Date;
  shardCount: number;
  publishedAt: Date;
}

/**
 * Transparency checkpoints visible to one tenant: the aggregate root plus only
 * that tenant's own head, extracted in SQL so other tenants' heads never leave
 * the database.
 */
export async function listMerkleRoots(tenant: string, limit = 20): Promise<TenantMerkleHead[]> {
  return withTenantRead(tenant, async (db) => {
    return db
      .select({
        id: auditMerkleRoots.id,
        rootHash: auditMerkleRoots.rootHash,
        headHash: sql<string | null>`${auditMerkleRoots.heads} ->> ${tenant}`,
        periodStart: auditMerkleRoots.periodStart,
        periodEnd: auditMerkleRoots.periodEnd,
        shardCount: auditMerkleRoots.shardCount,
        publishedAt: auditMerkleRoots.publishedAt,
      })
      .from(auditMerkleRoots)
      .orderBy(desc(auditMerkleRoots.publishedAt))
      .limit(limit);
  });
}

/** Platform-only checkpoint listing (no tenant filtering; callers must be platform auth). */
export async function listGlobalMerkleRoots(limit = 20) {
  return withGlobalTenant(async (db) => {
    return db
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
  });
}
