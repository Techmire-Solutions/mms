import {
  pgTable,
  text,
  timestamp,
  index,
  integer,
  jsonb,
  primaryKey,
  varchar,
  bigint,
  boolean,
} from "drizzle-orm/pg-core";
import { desc, sql } from "drizzle-orm";
import { workspaces } from "./platform.js";

/**
 * Modern 5-dimension database audit trail events table.
 * Partitioned by RANGE (transaction_timestamp) for monthly bounding and zero-downtime archival.
 *
 * Who: realUserId, impersonatedUserId, ipAddress, clientApp, sessionId
 * What: tableName, recordId, oldState, newState (canonical JSON)
 * When: transactionTimestamp (UTC clock timestamp)
 * Why: correlationId (W3C traceparent), actionType, apiEndpoint, httpMethod
 * Integrity: hashPrevious, hashCurrent, verificationStatus
 */
export const auditTrailEvents = pgTable(
  "audit_trail_events",
  {
    id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    tableName: varchar("table_name", { length: 64 }).notNull(),
    recordId: varchar("record_id", { length: 128 }).notNull(),
    actionType: varchar("action_type", { length: 32 }).notNull(),
    realUserId: varchar("real_user_id", { length: 64 }).notNull(),
    impersonatedUserId: varchar("impersonated_user_id", { length: 64 }),
    ipAddress: varchar("ip_address", { length: 45 }),
    clientApp: varchar("client_app", { length: 64 }),
    sessionId: varchar("session_id", { length: 128 }),
    correlationId: varchar("correlation_id", { length: 128 }).notNull(),
    apiEndpoint: varchar("api_endpoint", { length: 255 }),
    httpMethod: varchar("http_method", { length: 16 }),
    oldState: text("old_state"),
    newState: text("new_state"),
    hashPrevious: varchar("hash_previous", { length: 64 }).notNull(),
    hashCurrent: varchar("hash_current", { length: 64 }).notNull(),
    verificationStatus: varchar("verification_status", { length: 32 }).notNull().default("PENDING"),
    transactionTimestamp: timestamp("transaction_timestamp", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .default(sql`clock_timestamp()`),
  },
  (table) => [
    primaryKey({
      columns: [table.workspaceSubdomain, table.transactionTimestamp, table.id],
    }),
    index("audit_trail_events_ws_ts_desc_idx").on(
      table.workspaceSubdomain,
      desc(table.transactionTimestamp),
    ),
    index("audit_trail_events_ws_table_rec_idx").on(
      table.workspaceSubdomain,
      table.tableName,
      table.recordId,
    ),
    index("audit_trail_events_ws_action_idx").on(table.workspaceSubdomain, table.actionType),
    index("audit_trail_events_ws_corr_idx").on(table.workspaceSubdomain, table.correlationId),
    index("audit_trail_events_ws_user_idx").on(table.workspaceSubdomain, table.realUserId),
  ],
);

export type AuditTrailEventRow = typeof auditTrailEvents.$inferSelect;
export type InsertAuditTrailEventRow = typeof auditTrailEvents.$inferInsert;

/**
 * Append-only record of automated cryptographic integrity verification runs.
 */
export const auditVerificationRuns = pgTable(
  "audit_verification_runs",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceSubdomain: text("workspace_subdomain").references(() => workspaces.subdomain, {
      onDelete: "cascade",
    }),
    verifiedAt: timestamp("verified_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .default(sql`clock_timestamp()`),
    recordsChecked: integer("records_checked").notNull(),
    status: varchar("status", { length: 32 }).notNull(),
    discrepancies: jsonb("discrepancies").$type<string[]>().notNull().default([]),
    /** Anchor this run verified from (null = chain genesis). */
    fromId: bigint("from_id", { mode: "number" }),
    fromTimestamp: timestamp("from_timestamp", { withTimezone: true, mode: "date" }),
    fromHash: varchar("from_hash", { length: 64 }),
    /** Head this run reached; the next run resumes strictly after it. */
    toId: bigint("to_id", { mode: "number" }),
    toTimestamp: timestamp("to_timestamp", { withTimezone: true, mode: "date" }),
    toHash: varchar("to_hash", { length: 64 }),
    /** False when the anchor row is no longer visible (e.g. an archived partition). */
    anchored: boolean("anchored").notNull().default(true),
  },
  (table) => [
    index("audit_verification_runs_ws_time_idx").on(
      table.workspaceSubdomain,
      desc(table.verifiedAt),
    ),
  ],
);

export type AuditVerificationRunRow = typeof auditVerificationRuns.$inferSelect;
export type InsertAuditVerificationRunRow = typeof auditVerificationRuns.$inferInsert;

/**
 * Merkle root rollups for certificate-transparency scaling across shard heads.
 */
export const auditMerkleRoots = pgTable(
  "audit_merkle_roots",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    rootHash: varchar("root_hash", { length: 64 }).notNull(),
    periodStart: timestamp("period_start", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    periodEnd: timestamp("period_end", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    shardCount: integer("shard_count").notNull(),
    /** Published head hash per workspace shard (tenant-scoped reads use this map). */
    heads: jsonb("heads").$type<Record<string, string>>().notNull().default({}),
    publishedAt: timestamp("published_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .default(sql`clock_timestamp()`),
  },
  (table) => [index("audit_merkle_roots_published_desc_idx").on(desc(table.publishedAt))],
);

export type AuditMerkleRootRow = typeof auditMerkleRoots.$inferSelect;
export type InsertAuditMerkleRootRow = typeof auditMerkleRoots.$inferInsert;

/**
 * Crypto-shredding keys table: manages per-subject AES-256 encryption keys.
 * Deleting or zeroing out the subject key shreds sensitive personal data
 * while preserving immutable audit rows and intact cryptographic hash chains.
 */
export const cryptoShreddingKeys = pgTable(
  "crypto_shredding_keys",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    /** Nullable only for legacy rows written before tenant scoping; new rows must set it. */
    workspaceSubdomain: text("workspace_subdomain").references(() => workspaces.subdomain, {
      onDelete: "cascade",
    }),
    subjectId: varchar("subject_id", { length: 128 }).notNull(),
    encryptedKey: text("encrypted_key").notNull(),
    algorithm: varchar("algorithm", { length: 32 }).notNull().default("AES-256-GCM"),
    status: varchar("status", { length: 16 }).notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .default(sql`clock_timestamp()`),
    destroyedAt: timestamp("destroyed_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [
    index("crypto_shredding_keys_subject_status_idx").on(table.subjectId, table.status),
    index("crypto_shredding_keys_ws_subject_status_idx").on(
      table.workspaceSubdomain,
      table.subjectId,
      table.status,
    ),
  ],
);

export type CryptoShreddingKeyRow = typeof cryptoShreddingKeys.$inferSelect;
export type InsertCryptoShreddingKeyRow = typeof cryptoShreddingKeys.$inferInsert;

/**
 * Log of right-to-erasure (GDPR/privacy) requests and fulfillment details.
 */
export const auditErasureRequests = pgTable(
  "audit_erasure_requests",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    /** Nullable only for legacy rows written before tenant scoping; new rows must set it. */
    workspaceSubdomain: text("workspace_subdomain").references(() => workspaces.subdomain, {
      onDelete: "cascade",
    }),
    subjectId: varchar("subject_id", { length: 128 }).notNull(),
    regime: varchar("regime", { length: 32 }).notNull(),
    erasureType: varchar("erasure_type", { length: 32 }).notNull(),
    requestedBy: varchar("requested_by", { length: 64 }).notNull(),
    requestedAt: timestamp("requested_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .default(sql`clock_timestamp()`),
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "date",
    }),
    redactionMarker: varchar("redaction_marker", { length: 64 })
      .notNull()
      .default("[REDACTED_PER_REQUEST]"),
  },
  (table) => [
    index("audit_erasure_requests_subject_time_idx").on(table.subjectId, desc(table.requestedAt)),
    index("audit_erasure_requests_ws_subject_time_idx").on(
      table.workspaceSubdomain,
      table.subjectId,
      desc(table.requestedAt),
    ),
  ],
);

export type AuditErasureRequestRow = typeof auditErasureRequests.$inferSelect;
export type InsertAuditErasureRequestRow = typeof auditErasureRequests.$inferInsert;
