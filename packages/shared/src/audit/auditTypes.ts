import { z } from "zod";

// ---------------------------------------------------------------------------
// Modern Database Audit Trail Standards (RFC 8785 / 5-Dimension Architecture)
// ---------------------------------------------------------------------------

export const AUDIT_ACTION_TYPES = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "VIEW",
  "LOGIN",
  "REDACT",
  "RESTORE",
] as const;
export const auditActionTypeSchema = z.enum(AUDIT_ACTION_TYPES);
export type AuditActionType = z.infer<typeof auditActionTypeSchema>;

export const AUDIT_VERIFICATION_STATUSES = [
  "VERIFIED",
  "PENDING",
  "BROKEN_CHAIN",
  "SEQUENCE_GAP",
  "TAMPERED",
] as const;
export const auditVerificationStatusSchema = z.enum(AUDIT_VERIFICATION_STATUSES);
export type AuditVerificationStatus = z.infer<typeof auditVerificationStatusSchema>;

export const AUDIT_STORAGE_TIERS = ["HOT", "WARM", "COLD"] as const;
export const auditStorageTierSchema = z.enum(AUDIT_STORAGE_TIERS);
export type AuditStorageTier = z.infer<typeof auditStorageTierSchema>;

export const AUDIT_RETENTION_REGIMES = ["HIPAA", "SOX", "PCI_DSS", "GDPR"] as const;
export const auditRetentionRegimeSchema = z.enum(AUDIT_RETENTION_REGIMES);
export type AuditRetentionRegime = z.infer<typeof auditRetentionRegimeSchema>;

/**
 * Modern 5-dimension database audit event schema.
 * Captures Who, What, When, Why, and Integrity with RFC 8785 canonical JSON state deltas.
 */
export const modernAuditEventSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    workspaceSubdomain: z.string(),
    tableName: z.string(),
    recordId: z.string(),
    actionType: auditActionTypeSchema,
    realUserId: z.string(),
    impersonatedUserId: z.string().nullable().optional(),
    ipAddress: z.string().nullable().optional(),
    clientApp: z.string().nullable().optional(),
    sessionId: z.string().nullable().optional(),
    correlationId: z.string(),
    apiEndpoint: z.string().nullable().optional(),
    httpMethod: z.string().nullable().optional(),
    oldState: z.string().nullable().optional(),
    newState: z.string().nullable().optional(),
    hashPrevious: z.string(),
    hashCurrent: z.string(),
    verificationStatus: auditVerificationStatusSchema.default("VERIFIED"),
    transactionTimestamp: z.string(),
  })
  .strict();

export type ModernAuditEvent = z.infer<typeof modernAuditEventSchema>;

/**
 * Insert schema for modern database audit events.
 */
export const modernAuditEventInsertSchema = modernAuditEventSchema
  .omit({
    id: true,
  })
  .extend({
    id: z.union([z.string(), z.number()]).optional(),
    verificationStatus: auditVerificationStatusSchema.default("VERIFIED").optional(),
  })
  .strict();

export type ModernAuditEventInsert = z.infer<typeof modernAuditEventInsertSchema>;

/**
 * Audit verification run record schema for scheduled automated integrity verification.
 */
export const auditVerificationRunSchema = z
  .object({
    id: z.string(),
    verifiedAt: z.string(),
    recordsChecked: z.number().int().nonnegative(),
    status: auditVerificationStatusSchema,
    discrepancies: z.array(z.string()).default([]),
  })
  .strict();

export type AuditVerificationRun = z.infer<typeof auditVerificationRunSchema>;

/**
 * Merkle tree root rollup checkpoint schema for certificate-transparency scaling.
 */
export const auditMerkleRootSchema = z
  .object({
    id: z.string(),
    rootHash: z.string(),
    periodStart: z.string(),
    periodEnd: z.string(),
    shardCount: z.number().int().nonnegative(),
    publishedAt: z.string(),
  })
  .strict();

export type AuditMerkleRoot = z.infer<typeof auditMerkleRootSchema>;

/**
 * Crypto-shredding subject encryption key schema for right-to-erasure compliance.
 */
export const cryptoShreddingKeySchema = z
  .object({
    id: z.string(),
    subjectId: z.string(),
    encryptedKey: z.string(),
    algorithm: z.literal("AES-256-GCM").default("AES-256-GCM"),
    status: z.enum(["ACTIVE", "SHREDDED"]).default("ACTIVE"),
    createdAt: z.string(),
    destroyedAt: z.string().nullable().optional(),
  })
  .strict();

export type CryptoShreddingKey = z.infer<typeof cryptoShreddingKeySchema>;

/**
 * Erasure request record schema for tracking privacy / right-to-erasure execution.
 */
export const auditErasureRequestSchema = z
  .object({
    id: z.string(),
    subjectId: z.string(),
    regime: auditRetentionRegimeSchema,
    erasureType: z.enum(["CRYPTO_SHRED", "REDACT_APPEND"]),
    requestedBy: z.string(),
    requestedAt: z.string(),
    completedAt: z.string().nullable().optional(),
    redactionMarker: z.string().default("[REDACTED_PER_REQUEST]"),
  })
  .strict();

export type AuditErasureRequest = z.infer<typeof auditErasureRequestSchema>;

/** Genesis hash used as hashPrevious for the first event in a shard chain. */
export const GENESIS_AUDIT_HASH = "0".repeat(64);

/**
 * Constructs the canonical raw input string to be hashed with SHA-256:
 * formula: hashPrevious + canonicalPayloadJson + transactionTimestamp
 */
export function formatAuditEventHashInput(
  hashPrevious: string,
  canonicalPayloadJson: string,
  transactionTimestamp: string,
): string {
  return `${hashPrevious}${canonicalPayloadJson}${transactionTimestamp}`;
}

/**
 * Statutory retention floor in days per regulatory regime (Section 4):
 * - HIPAA: 6 years (2,190 days)
 * - SOX: 7 years (2,555 days)
 * - PCI-DSS: 1 year (365 days; 3 months online minimum)
 * - GDPR: 3 years (1,095 days default, varies by category)
 */
export const AUDIT_RETENTION_FLOORS: Record<AuditRetentionRegime, number> = {
  HIPAA: 6 * 365,
  SOX: 7 * 365,
  PCI_DSS: 1 * 365,
  GDPR: 3 * 365,
};

export const AUDIT_ANOMALY_TYPES = [
  "VOLUME_SPIKE",
  "AFTER_HOURS_ACTIVITY",
  "MULTI_IP_ACCESS",
] as const;
export const auditAnomalyTypeSchema = z.enum(AUDIT_ANOMALY_TYPES);
export type AuditAnomalyType = z.infer<typeof auditAnomalyTypeSchema>;

export const auditAnomalyItemSchema = z
  .object({
    type: auditAnomalyTypeSchema,
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    description: z.string(),
    userId: z.string().optional(),
    ipAddress: z.string().optional(),
    count: z.number().optional(),
    detectedAt: z.string(),
  })
  .strict();
export type AuditAnomalyItem = z.infer<typeof auditAnomalyItemSchema>;

export const auditAnomalyReportSchema = z
  .object({
    workspaceSubdomain: z.string(),
    evaluatedAt: z.string(),
    anomalies: z.array(auditAnomalyItemSchema),
  })
  .strict();
export type AuditAnomalyReport = z.infer<typeof auditAnomalyReportSchema>;

export { calculateStateDelta } from "./auditStateDelta.js";

/** Paginated audit event list query schema. */
export const listAuditEventsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(25),
    offset: z.coerce.number().int().min(0).default(0),
    tableName: z.string().optional(),
    recordId: z.string().optional(),
    actionType: auditActionTypeSchema.optional(),
  })
  .strict();

export type ListAuditEventsQuery = z.infer<typeof listAuditEventsQuerySchema>;

/** Audit anomalies detection query schema. */
export const auditAnomaliesQuerySchema = z
  .object({
    windowHours: z.coerce.number().int().min(1).max(168).default(24),
  })
  .strict();

export type AuditAnomaliesQuery = z.infer<typeof auditAnomaliesQuerySchema>;

/** GDPR / privacy right-to-erasure execution payload schema. */
export const executeErasureBodySchema = z
  .object({
    subjectId: z.string().min(1),
    regime: auditRetentionRegimeSchema,
    erasureType: z.enum(["CRYPTO_SHRED", "REDACT_APPEND"]),
    reason: z.string().optional(),
  })
  .strict();

export type ExecuteErasureBody = z.infer<typeof executeErasureBodySchema>;

/** Audit retention evaluation payload schema. */
export const retentionEvaluateBodySchema = z
  .object({
    regime: auditRetentionRegimeSchema,
    dryRun: z.boolean().default(true),
  })
  .strict();

export type RetentionEvaluateBody = z.infer<typeof retentionEvaluateBodySchema>;
