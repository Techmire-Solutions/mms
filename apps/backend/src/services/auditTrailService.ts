import crypto from "node:crypto";
import { desc, eq, sql } from "drizzle-orm";
import {
  canonicalizeJson,
  formatAuditEventHashInput,
  GENESIS_AUDIT_HASH,
  calculateStateDelta,
  type AuditActionType,
} from "@mms/shared";
import { activeDb } from "../db/dbConnection.js";
import { hasActiveTransaction } from "../db/dbTransactions.js";
import { withTenant, withTenantRead } from "../db/tenant-context.js";
import { auditTrailEvents } from "../db/schema/auditTrail.js";
import { getCurrentSpanContext, formatTraceParent } from "../config/telemetry.js";
import {
  getRequestTenant,
  getRequestUserId,
  getRequestAuditContext,
} from "../lib/tenantContext.js";
import { logger } from "../lib/logger.js";
import { sanitizeAuditState } from "../lib/auditState.js";

export { mapActionStringToAuditType, sanitizeAuditState } from "../lib/auditState.js";

export interface RecordModernAuditInput {
  workspaceSubdomain: string;
  tableName: string;
  recordId: string;
  actionType: AuditActionType;
  realUserId?: string | null;
  impersonatedUserId?: string | null;
  ipAddress?: string | null;
  clientApp?: string | null;
  sessionId?: string | null;
  correlationId?: string | null;
  apiEndpoint?: string | null;
  httpMethod?: string | null;
  oldState?: unknown;
  newState?: unknown;
  minimizeDelta?: boolean;
  transactionTimestamp?: Date;
  /**
   * Person/record whose subject key encrypts `oldState`/`newState` at capture.
   * When set, destroying that key (right-to-erasure) makes the stored state
   * unreadable while the hash chain stays intact.
   */
  subjectId?: string;
}

export type DbOrTransaction = ReturnType<typeof activeDb>;

export interface AuditShardHead {
  hash: string;
  timestamp: Date | null;
}

/**
 * Retrieves the latest head hash/timestamp for a tenant workspace shard.
 * Returns GENESIS with a null timestamp if no events exist in this shard.
 */
export async function getShardHead(
  workspaceSubdomain: string,
  executor?: DbOrTransaction,
): Promise<AuditShardHead> {
  const subdomain = workspaceSubdomain.trim().toLowerCase();
  if (!executor && !hasActiveTransaction()) {
    return withTenantRead(subdomain, (tx) =>
      getShardHead(subdomain, tx as unknown as DbOrTransaction),
    );
  }
  const db = executor ?? activeDb();
  const latestRows = await db
    .select({
      hashCurrent: auditTrailEvents.hashCurrent,
      transactionTimestamp: auditTrailEvents.transactionTimestamp,
    })
    .from(auditTrailEvents)
    .where(eq(auditTrailEvents.workspaceSubdomain, subdomain))
    .orderBy(desc(auditTrailEvents.transactionTimestamp), desc(auditTrailEvents.id))
    .limit(1);

  const head = latestRows[0];
  return {
    hash: head?.hashCurrent ?? GENESIS_AUDIT_HASH,
    timestamp: head?.transactionTimestamp ?? null,
  };
}

/**
 * Retrieves the latest head hash for a tenant workspace shard.
 * Returns GENESIS_AUDIT_HASH ('0'.repeat(64)) if no events exist in this shard.
 */
export async function getLatestShardHash(
  workspaceSubdomain: string,
  executor?: DbOrTransaction,
): Promise<string> {
  // Undefined lets `getShardHead` open its own tenant-scoped read (RLS-safe).
  return (await getShardHead(workspaceSubdomain, executor)).hash;
}

interface AppendResult {
  id?: number;
  hashPrevious: string;
  hashCurrent: string;
  canonicalPayload: string;
}

/**
 * Appends an event inside the caller's transaction. The caller is responsible for
 * transaction scope; this is the only place the hash chain ordering is decided.
 */
async function appendAuditEvent(
  tx: DbOrTransaction,
  input: RecordModernAuditInput,
): Promise<AppendResult> {
  const subdomain = input.workspaceSubdomain.trim().toLowerCase();
  if (!subdomain) throw new Error("[audit] workspaceSubdomain is required");

  // 0. Serialize appends per shard. The lock is transaction-scoped and released
  // on commit/rollback, so the head read + insert are one critical section.
  if (typeof tx.execute === "function") {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`audit:${subdomain}`}))`);
  }

  // 1. Sharded head resolution. The ordering key is chosen *after* the lock, and
  // clamped above the previous head so a clock step cannot invert the chain.
  const head = await getShardHead(subdomain, tx);
  const requested = input.transactionTimestamp ?? new Date();
  const timestamp =
    head.timestamp && requested.getTime() <= head.timestamp.getTime()
      ? new Date(head.timestamp.getTime() + 1)
      : requested;
  const timestampIso = timestamp.toISOString();
  const hashPrevious = head.hash;

  // 2. State Sanitization & RFC 8785 Canonicalization (with capture-time minimization)
  let rawOld = input.oldState;
  let rawNew = input.newState;
  if (input.minimizeDelta && rawOld !== undefined && rawNew !== undefined) {
    const delta = calculateStateDelta(rawOld, rawNew);
    rawOld = delta.oldDelta;
    rawNew = delta.newDelta;
  }

  const sanitizedOld = rawOld !== undefined ? sanitizeAuditState(rawOld) : null;
  const sanitizedNew = rawNew !== undefined ? sanitizeAuditState(rawNew) : null;

  let oldStateCanonical = sanitizedOld !== null ? canonicalizeJson(sanitizedOld) : null;
  let newStateCanonical = sanitizedNew !== null ? canonicalizeJson(sanitizedNew) : null;

  // 2b. Subject-state encryption keeps erasure meaningful for new events. The
  // codec lives in its own module to avoid an audit <-> crypto service cycle.
  if (input.subjectId) {
    const { encryptSubjectAuditState } = await import("../lib/subjectKeyService.js");
    oldStateCanonical = await encryptSubjectAuditState(
      subdomain,
      input.subjectId,
      oldStateCanonical,
    );
    newStateCanonical = await encryptSubjectAuditState(
      subdomain,
      input.subjectId,
      newStateCanonical,
    );
  }

  // 3. Correlation ID & User ID Resolution with AsyncLocalStorage fallback
  const reqContext = getRequestAuditContext();
  const activeSpan = getCurrentSpanContext();
  const correlationId =
    input.correlationId?.trim() ||
    reqContext?.correlationId ||
    (activeSpan ? formatTraceParent(activeSpan) : null) ||
    `00-${crypto.randomBytes(16).toString("hex")}-${crypto.randomBytes(8).toString("hex")}-01`;

  const realUserId = input.realUserId?.trim() || getRequestUserId() || "system";
  const impersonatedUserId = input.impersonatedUserId ?? reqContext?.impersonatedUserId ?? null;
  const ipAddress = input.ipAddress ?? reqContext?.ipAddress ?? null;
  const clientApp = input.clientApp ?? reqContext?.clientApp ?? null;
  const sessionId = input.sessionId ?? reqContext?.sessionId ?? null;
  const apiEndpoint = input.apiEndpoint ?? reqContext?.apiEndpoint ?? null;
  const httpMethod = input.httpMethod ?? reqContext?.httpMethod ?? null;

  // 4. Deterministic Payload Object for Hashing
  const payloadForHashing = {
    actionType: input.actionType,
    apiEndpoint,
    clientApp,
    correlationId,
    httpMethod,
    impersonatedUserId,
    ipAddress,
    newState: newStateCanonical,
    oldState: oldStateCanonical,
    realUserId,
    recordId: input.recordId,
    sessionId,
    tableName: input.tableName,
    workspaceSubdomain: subdomain,
  };

  const canonicalPayload = canonicalizeJson(payloadForHashing);

  // 5. Cryptographic Hash Construction
  const hashInput = formatAuditEventHashInput(hashPrevious, canonicalPayload, timestampIso);
  const hashCurrent = crypto.hash("sha256", hashInput, "hex");

  // 6. Atomically Persist Event
  const inserted = await tx
    .insert(auditTrailEvents)
    .values({
      workspaceSubdomain: subdomain,
      tableName: input.tableName,
      recordId: input.recordId,
      actionType: input.actionType,
      realUserId,
      impersonatedUserId,
      ipAddress,
      clientApp,
      sessionId,
      correlationId,
      apiEndpoint,
      httpMethod,
      oldState: oldStateCanonical,
      newState: newStateCanonical,
      hashPrevious,
      hashCurrent,
      // The row cannot assert its own verification: a verifier run records that.
      verificationStatus: "PENDING",
      transactionTimestamp: timestamp,
    })
    .returning({ id: auditTrailEvents.id });

  return {
    id: inserted[0]?.id,
    hashPrevious,
    hashCurrent,
    canonicalPayload,
  };
}

/**
 * Records a modern 5-dimension audit event.
 *
 * Always transactional: when the caller already owns a transaction the event
 * joins it (Outbox rule); otherwise a tenant transaction is opened for the
 * append. This is what makes `FORCE ROW LEVEL SECURITY` accept the insert and
 * what lets a business mutation roll the audit row back with it.
 */
export async function recordModernAuditEvent(input: RecordModernAuditInput): Promise<AppendResult>;
export async function recordModernAuditEvent(
  tx: DbOrTransaction,
  input: RecordModernAuditInput,
): Promise<AppendResult>;
export async function recordModernAuditEvent(
  first: DbOrTransaction | RecordModernAuditInput,
  second?: RecordModernAuditInput,
): Promise<AppendResult> {
  const input = (second ?? first) as RecordModernAuditInput;
  const subdomain = input.workspaceSubdomain.trim().toLowerCase();
  const requestTenant = getRequestTenant()?.trim().toLowerCase();

  // Never let a bug write into another workspace's chain.
  if (requestTenant && requestTenant !== subdomain) {
    throw new Error(
      `[audit] refusing to append to "${subdomain}" from a "${requestTenant}" request`,
    );
  }

  if (second !== undefined) {
    // The caller owns the executor; it must already be inside a transaction.
    return appendAuditEvent(first as DbOrTransaction, input);
  }

  if (hasActiveTransaction()) {
    return appendAuditEvent(activeDb(), input);
  }

  return withTenant(subdomain, (tenantTx) =>
    appendAuditEvent(tenantTx as unknown as DbOrTransaction, input),
  );
}

/**
 * Best-effort append for read-side events (VIEW/EXPORT) where failing the read
 * would hide the data the audit row describes. Mutations must use the throwing
 * `recordModernAuditEvent`.
 */
export async function recordAuditEventSafely(input: RecordModernAuditInput): Promise<void> {
  try {
    await recordModernAuditEvent(input);
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error.message : String(error), table: input.tableName },
      "audit event append failed",
    );
  }
}
