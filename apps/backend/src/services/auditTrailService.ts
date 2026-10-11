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
import { auditTrailEvents } from "../db/schema/auditTrail.js";
import { getCurrentSpanContext, formatTraceParent } from "../config/telemetry.js";
import { getRequestUserId, getRequestAuditContext } from "../lib/tenantContext.js";

/**
 * Maps an action string to a canonical `AuditActionType`.
 */
export function mapActionStringToAuditType(action: string): AuditActionType {
  const lower = action.toLowerCase();
  if (lower.includes("create") || lower.includes("add") || lower.includes("insert"))
    return "CREATE";
  if (
    lower.includes("delete") ||
    lower.includes("remove") ||
    lower.includes("purge") ||
    lower.includes("archive")
  )
    return "DELETE";
  if (lower.includes("login") || lower.includes("auth")) return "LOGIN";
  if (lower.includes("restore")) return "RESTORE";
  if (lower.includes("view") || lower.includes("read") || lower.includes("export")) return "VIEW";
  if (lower.includes("redact")) return "REDACT";
  return "UPDATE";
}

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
}

/** Fields to automatically strip at capture time to minimize PII and avoid secret leakage. */
const REDACTED_KEYS = new Set([
  "password",
  "passwordHash",
  "password_hash",
  "salt",
  "secret",
  "token",
  "refreshToken",
  "refresh_token",
  "jwt",
  "apiKey",
  "api_key",
]);

/**
 * Minimizes state payloads at capture time: strips credentials and unneeded heavy secrets.
 */
export function sanitizeAuditState(state: unknown): unknown {
  if (state === null || typeof state !== "object") {
    return state;
  }
  if (Array.isArray(state)) {
    return state.map(sanitizeAuditState);
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(state as Record<string, unknown>)) {
    if (REDACTED_KEYS.has(key)) {
      sanitized[key] = "[REDACTED_SECRET]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeAuditState(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export type DbOrTransaction = ReturnType<typeof activeDb>;

/**
 * Retrieves the latest head hash for a tenant workspace shard.
 * Returns GENESIS_AUDIT_HASH ('0'.repeat(64)) if no events exist in this shard.
 */
export async function getLatestShardHash(
  workspaceSubdomain: string,
  executor: DbOrTransaction = activeDb(),
): Promise<string> {
  const subdomain = workspaceSubdomain.trim().toLowerCase();
  const latestRows = await executor
    .select({
      hashCurrent: auditTrailEvents.hashCurrent,
    })
    .from(auditTrailEvents)
    .where(eq(auditTrailEvents.workspaceSubdomain, subdomain))
    .orderBy(desc(auditTrailEvents.transactionTimestamp), desc(auditTrailEvents.id))
    .limit(1);

  return latestRows[0]?.hashCurrent ?? GENESIS_AUDIT_HASH;
}

/**
 * Records a modern 5-dimension audit event atomically inside an existing database transaction (Outbox),
 * or directly against the active database pool when outside a transaction.
 * Enforces RFC 8785 canonical JSON, sharded cryptographic hash chaining, and capture-time minimization.
 */
export async function recordModernAuditEvent(
  input: RecordModernAuditInput,
): Promise<{ id?: number; hashPrevious: string; hashCurrent: string; canonicalPayload: string }>;
export async function recordModernAuditEvent(
  tx: DbOrTransaction,
  input: RecordModernAuditInput,
): Promise<{ id?: number; hashPrevious: string; hashCurrent: string; canonicalPayload: string }>;
export async function recordModernAuditEvent(
  first: DbOrTransaction | RecordModernAuditInput,
  second?: RecordModernAuditInput,
): Promise<{
  id?: number;
  hashPrevious: string;
  hashCurrent: string;
  canonicalPayload: string;
}> {
  let tx: DbOrTransaction;
  let input: RecordModernAuditInput;

  if (second !== undefined) {
    tx = first as DbOrTransaction;
    input = second;
  } else {
    tx = activeDb();
    input = first as RecordModernAuditInput;
  }

  const subdomain = input.workspaceSubdomain.trim().toLowerCase();
  const timestamp = input.transactionTimestamp ?? new Date();
  const timestampIso = timestamp.toISOString();

  // 0. Serialize appends per shard. Without this, two concurrent transactions
  // both read the same head hash and insert with the same `hash_previous`,
  // forking the chain and making verification report BROKEN_CHAIN. The lock is
  // transaction-scoped and released on commit/rollback.
  if (typeof tx.execute === "function") {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`audit:${subdomain}`}))`);
  }

  // 1. Sharded Hash Resolution: Fetch latest hash in this tenant shard
  const hashPrevious = await getLatestShardHash(subdomain, tx);

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

  const oldStateCanonical = sanitizedOld !== null ? canonicalizeJson(sanitizedOld) : null;
  const newStateCanonical = sanitizedNew !== null ? canonicalizeJson(sanitizedNew) : null;

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
  // hash_current = SHA-256(hash_previous + canonical_json(payload) + transaction_timestamp)
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
      verificationStatus: "VERIFIED",
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
