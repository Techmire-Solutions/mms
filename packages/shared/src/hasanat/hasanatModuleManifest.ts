import type { Permission } from "../auth/permissions.js";
import { z } from "zod";
import { isoDateSchema } from "../core/isoDateSchema.js";
import { HASANAT_CARD_STATUSES } from "./hasanatCardRules.js";
import { HASANAT_RECIPIENT_TYPES } from "./hasanatEnums.js";
import { hasanatCommandMetricsSnapshotSchema } from "../settings/moduleCommandMetricsFinance.js";

export const denomRecordSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    /** Domain bounds (`validateDenomPoints`) are 1..100000; 0 is tolerated on read only. */
    points: z.number().int().min(0).max(100_000).default(0),
    color: z.string().default("emerald"),
    description: z.string().default(""),
    icon: z.string().default("Star"),
    active: z.boolean().default(true),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .strict();

export const denomRecordInsertSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().min(1, "Name is required"),
    points: z.number().int().min(1).max(100_000),
    color: z.string().optional().default("emerald"),
    description: z.string().optional().default(""),
    icon: z.string().optional().default("Star"),
    active: z.boolean().optional().default(true),
  })
  .strict();

export type Denomination = z.infer<typeof denomRecordSchema>;
export type DenominationInsert = z.infer<typeof denomRecordInsertSchema>;
export const denomListSchema = z.array(denomRecordSchema);

/** Denomination list envelope (bounded). */
export const hasanatDenomsResponseSchema = z.object({
  denoms: z.array(denomRecordSchema),
  total: z.number(),
});

/** Shared `limit`/`offset` query for bounded setup lists. */
export const hasanatListLimitQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(1000).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  })
  .strict();

export const batchRecordSchema = z
  .object({
    id: z.string(),
    denominationId: z.string(),
    denominationName: z.string().default(""),
    quantity: z.number().default(0),
    remaining: z.number().default(0),
    addedDate: z.string(),
    addedByUserId: z.string().nullable().optional(),
    addedBy: z.string().nullable().optional(),
    note: z.string().default(""),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .strict();

export const batchRecordInsertSchema = z
  .object({
    id: z.string().optional(),
    denominationId: z.string().min(1, "Denomination is required"),
    denominationName: z.string().optional().default(""),
    quantity: z.number().positive("Quantity must be greater than 0"),
    remaining: z.number().nonnegative().optional(),
    addedDate: isoDateSchema,
    addedByUserId: z.string().nullable().optional(),
    addedBy: z.string().nullable().optional(),
    note: z.string().optional().default(""),
  })
  .strict();

export type StockBatch = z.infer<typeof batchRecordSchema>;
export type StockBatchInsert = z.infer<typeof batchRecordInsertSchema>;
export const batchListSchema = z.array(batchRecordSchema);

/** Batch stock list envelope (bounded page). */
export const hasanatBatchesResponseSchema = z.object({
  batches: z.array(batchRecordSchema),
  total: z.number(),
  hasMore: z.boolean(),
});

export const distributionRecordSchema = z
  .object({
    id: z.string(),
    batchId: z.string(),
    denominationId: z.string(),
    denominationName: z.string().default(""),
    recipientType: z.enum(HASANAT_RECIPIENT_TYPES).default("student"),
    recipientStudentId: z.string().nullable().optional(),
    recipientFacultyId: z.string().nullable().optional(),
    recipientName: z.string().optional().default(""),
    recipientClass: z.string().default(""),
    /** `session_classes.id` at issue time; `recipientClass` is the display snapshot. */
    classId: z.string().nullable().optional(),
    /** `sessions.id` at issue time — stamped by the DB from `classId`. */
    sessionId: z.string().nullable().optional(),
    quantity: z.number().default(1),
    /** Immutable card value stamped at issue (`denom.points × quantity`). */
    pointsSnapshot: z.number().int().nonnegative().optional(),
    /** Optimistic-concurrency token for card edits. */
    version: z.number().int().nonnegative().optional(),
    /** Derived expiry: an `active` card past this date reads as expired. */
    expiresOn: isoDateSchema.nullable().optional(),
    reason: z.string().default(""),
    issuedDate: z.string(),
    issuedByUserId: z.string().nullable().optional(),
    issuedBy: z.string().nullable().optional(),
    status: z.enum(HASANAT_CARD_STATUSES).default("active"),
    deletedAt: z.string().nullable().optional(),
    deletedBy: z.string().nullable().optional(),
    deletionReason: z.string().nullable().optional(),
    restoredAt: z.string().nullable().optional(),
    restoredBy: z.string().nullable().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .strict();

/**
 * Write payload for issuing a card. Server-owned fields are absent by construction: `status` moves
 * only through the lifecycle action, `pointsSnapshot` is stamped from the deed, the soft-delete
 * and restore sextuple is owned by the delete/restore paths, and `version` is assigned by the DB.
 */
export const distributionCreateSchema = z
  .object({
    id: z.string().optional(),
    batchId: z.string().min(1, "Batch is required"),
    denominationId: z.string().min(1, "Denomination is required"),
    denominationName: z.string().optional().default(""),
    recipientType: z.enum(HASANAT_RECIPIENT_TYPES).default("student"),
    recipientStudentId: z.string().nullable().optional(),
    recipientFacultyId: z.string().nullable().optional(),
    recipientName: z.string().optional().default(""),
    recipientClass: z.string().optional().default(""),
    classId: z.string().nullable().optional(),
    sessionId: z.string().nullable().optional(),
    quantity: z.number().int().positive().default(1),
    expiresOn: isoDateSchema.nullable().optional(),
    reason: z.string().optional().default(""),
    issuedDate: isoDateSchema,
    issuedByUserId: z.string().nullable().optional(),
    issuedBy: z.string().nullable().optional(),
    /** Idempotency key: replaying the same key returns the card already issued. */
    clientRequestId: z.string().min(8).max(64).nullable().optional(),
  })
  .strict();

/**
 * Card edit payload. Value-affecting fields (`quantity`, `denominationId`, `batchId`) are absent by
 * design: the stamped `points_snapshot` is immutable, so a wrong value is voided and re-issued.
 */
export const distributionUpdateSchema = z
  .object({
    recipientType: z.enum(HASANAT_RECIPIENT_TYPES).optional(),
    recipientStudentId: z.string().nullable().optional(),
    recipientFacultyId: z.string().nullable().optional(),
    recipientName: z.string().optional(),
    recipientClass: z.string().optional(),
    classId: z.string().nullable().optional(),
    sessionId: z.string().nullable().optional(),
    expiresOn: isoDateSchema.nullable().optional(),
    reason: z.string().optional(),
    issuedDate: isoDateSchema.optional(),
    issuedByUserId: z.string().nullable().optional(),
    issuedBy: z.string().nullable().optional(),
    expectedVersion: z.number().int().nonnegative(),
  })
  .strict();

/** Card lifecycle action — the only way a persisted status changes. */
export const distributionStatusSchema = z
  .object({
    status: z.enum(HASANAT_CARD_STATUSES),
    reason: z.string().max(500).optional(),
    expectedVersion: z.number().int().nonnegative(),
  })
  .strict();

export const distributionRecordInsertSchema = distributionCreateSchema;
export const distributionRecordUpdateSchema = distributionUpdateSchema;

export type Distribution = z.infer<typeof distributionRecordSchema>;
export type DistributionInsert = z.infer<typeof distributionRecordInsertSchema>;
export const distributionListSchema = z.array(distributionRecordSchema);

export const isDistributionDeleted = (distribution: { deletedAt?: string | null }): boolean =>
  Boolean(distribution.deletedAt);

export const filterActiveDistributions = <T extends { deletedAt?: string | null }>(
  distributions: T[],
): T[] => distributions.filter((d) => !isDistributionDeleted(d));

export * from "./hasanatEnums.js";
export * from "./hasanatRedemptionSchemas.js";

/**
 * `GET /api/hasanat/metrics` envelope — the route replies `{ metrics }`.
 * Wraps the canonical snapshot schema (ints, non-negative, strict) rather than a second copy.
 */
export const hasanatCommandMetricsResponseSchema = z
  .object({ metrics: hasanatCommandMetricsSnapshotSchema })
  .strict();

export type DistributionCreate = z.infer<typeof distributionCreateSchema>;
export type DistributionUpdate = z.infer<typeof distributionUpdateSchema>;
export type DistributionStatusChange = z.infer<typeof distributionStatusSchema>;

/** Hasanat Cards module manifest — aligns with globle1 universal module architecture. */
export const HASANAT_MODULE_MANIFEST = {
  moduleId: "hasanat",
  entityType: "Distribution",
  collectionKey: "hasanat_distributions",
  batchCollectionKey: "hasanat_batches",
  denomCollectionKey: "hasanat_denoms",
  redemptionCollectionKey: "hasanat_redemptions",
  settingsObjectKey: "hasanat_settings",
  distributionColumnPreferencesObjectKey: "hasanat_distribution_user_column_preferences",
  redemptionColumnPreferencesObjectKey: "hasanat_redemption_user_column_preferences",
  restBasePath: "/api/hasanat",
  analyticsCategory: "hasanat",
  tiers: ["work", "reports", "setup"] as const,
  setupSubTabs: ["denominations", "preferences", "templates"] as const,
  softDelete: {
    workExcludesDeleted: true,
    reportsIncludeDeleted: false,
    exportsIncludeDeleted: false,
    captureDeletionReason: false,
    retentionDays: null,
  },
  permissions: {
    read: "hasanat.read",
    write: "hasanat.write",
    delete: "hasanat.delete",
    setupView: "configuration.view",
    setupWrite: "settings.global.write",
    export: "hasanat.read",
    reports: "hasanat.read",
  } satisfies Record<string, Permission>,
  work: {
    directoryViews: ["overview", "stock", "distribute", "redemptions"] as const,
    bulkActions: ["delete"] as const,
  },
  defaultPageSize: 15,
  maxPageSize: 100,
  /** Background CSV export (`createModuleExportService` manifest bits). */
  defaultExportFilename: "hasanat.csv",
  exportChunkSize: 250,
} as const;

export type HasanatModuleTier = (typeof HASANAT_MODULE_MANIFEST.tiers)[number];
