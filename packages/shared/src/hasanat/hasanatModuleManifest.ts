import type { Permission } from "../auth/permissions.js";
import { z } from "zod";
import { isoDateSchema } from "../core/isoDateSchema.js";

export const denomRecordSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    points: z.number().default(0),
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
    points: z.number().nonnegative(),
    color: z.string().optional().default("emerald"),
    description: z.string().optional().default(""),
    icon: z.string().optional().default("Star"),
    active: z.boolean().optional().default(true),
  })
  .strict();

export type Denomination = z.infer<typeof denomRecordSchema>;
export type DenominationInsert = z.infer<typeof denomRecordInsertSchema>;
export const denomListSchema = z.array(denomRecordSchema);

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

export const distributionRecordSchema = z
  .object({
    id: z.string(),
    batchId: z.string(),
    denominationId: z.string(),
    denominationName: z.string().default(""),
    recipientType: z.enum(["student", "faculty"]).default("student"),
    recipientStudentId: z.string().nullable().optional(),
    recipientFacultyId: z.string().nullable().optional(),
    recipientName: z.string().optional().default(""),
    recipientClass: z.string().default(""),
    /** `session_classes.id` at issue time; `recipientClass` is the display snapshot. */
    classId: z.string().nullable().optional(),
    quantity: z.number().default(1),
    reason: z.string().default(""),
    issuedDate: z.string(),
    issuedByUserId: z.string().nullable().optional(),
    issuedBy: z.string().nullable().optional(),
    status: z.enum(["active", "redeemed", "returned"]).default("active"),
    deletedAt: z.string().nullable().optional(),
    deletedBy: z.string().nullable().optional(),
    deletionReason: z.string().nullable().optional(),
    restoredAt: z.string().nullable().optional(),
    restoredBy: z.string().nullable().optional(),
    deletedWithCascade: z.boolean().nullable().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .strict();

export const distributionRecordInsertSchema = z
  .object({
    id: z.string().optional(),
    batchId: z.string().min(1, "Batch is required"),
    denominationId: z.string().min(1, "Denomination is required"),
    denominationName: z.string().optional().default(""),
    recipientType: z.enum(["student", "faculty"]).default("student"),
    recipientStudentId: z.string().nullable().optional(),
    recipientFacultyId: z.string().nullable().optional(),
    recipientName: z.string().optional().default(""),
    recipientClass: z.string().optional().default(""),
    classId: z.string().nullable().optional(),
    quantity: z.number().positive().default(1),
    reason: z.string().optional().default(""),
    issuedDate: isoDateSchema,
    issuedByUserId: z.string().nullable().optional(),
    issuedBy: z.string().nullable().optional(),
    status: z.enum(["active", "redeemed", "returned"]).optional().default("active"),
  })
  .strict();

export const distributionRecordUpdateSchema = distributionRecordInsertSchema.partial().strict();

export type Distribution = z.infer<typeof distributionRecordSchema>;
export type DistributionInsert = z.infer<typeof distributionRecordInsertSchema>;
export type DistributionUpdate = z.infer<typeof distributionRecordUpdateSchema>;
export const distributionListSchema = z.array(distributionRecordSchema);

export const isDistributionDeleted = (distribution: { deletedAt?: string | null }): boolean =>
  Boolean(distribution.deletedAt);

export const filterActiveDistributions = <T extends { deletedAt?: string | null }>(
  distributions: T[],
): T[] => distributions.filter((d) => !isDistributionDeleted(d));

export const redemptionRecordSchema = z
  .object({
    id: z.string(),
    distributionId: z.string(),
    studentName: z.string().optional().default(""),
    reward: z.string().default(""),
    pointsUsed: z.number().default(0),
    date: z.string(),
    approvedByUserId: z.string().nullable().optional(),
    approvedBy: z.string().nullable().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .strict();

export const redemptionRecordInsertSchema = z
  .object({
    id: z.string().optional(),
    distributionId: z.string().min(1, "Distribution is required"),
    studentName: z.string().optional().default(""),
    reward: z.string().min(1, "Reward is required"),
    pointsUsed: z.number().nonnegative().default(0),
    date: isoDateSchema,
    approvedByUserId: z.string().nullable().optional(),
    approvedBy: z.string().nullable().optional(),
  })
  .strict();

export type Redemption = z.infer<typeof redemptionRecordSchema>;
export type RedemptionInsert = z.infer<typeof redemptionRecordInsertSchema>;
export const redemptionListSchema = z.array(redemptionRecordSchema);

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
    delete: "hasanat.write",
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
} as const;

export type HasanatModuleTier = (typeof HASANAT_MODULE_MANIFEST.tiers)[number];
