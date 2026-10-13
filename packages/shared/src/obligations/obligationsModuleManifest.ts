import type { Permission } from "../auth/permissions.js";
import { z } from "zod";

export const obligationTypeRecordSchema = z
  .object({
    id: z.string(),
    name: z.string().min(1),
    quantity_based: z.boolean(),
    designated_for: z.enum(["Syed", "Non-Syed", "Both", "None"]),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .strict();

export type ObligationType = z.infer<typeof obligationTypeRecordSchema>;
export const obligationTypeListSchema = z.array(obligationTypeRecordSchema);

export const obligationTypeInsertSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().min(1),
    quantity_based: z.boolean().default(false),
    designated_for: z.enum(["Syed", "Non-Syed", "Both", "None"]).default("Both"),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .strict();

export type ObligationTypeInsert = z.infer<typeof obligationTypeInsertSchema>;
export const obligationTypeUpdateSchema = obligationTypeInsertSchema.partial();
export type ObligationTypeUpdate = z.infer<typeof obligationTypeUpdateSchema>;

export const mujtahidRecordSchema = z
  .object({
    id: z.string(),
    name: z.string().min(1),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .strict();

export type Mujtahid = z.infer<typeof mujtahidRecordSchema>;
export const mujtahidListSchema = z.array(mujtahidRecordSchema);

export const mujtahidInsertSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().min(1),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .strict();

export type MujtahidInsert = z.infer<typeof mujtahidInsertSchema>;
export const mujtahidUpdateSchema = mujtahidInsertSchema.partial();
export type MujtahidUpdate = z.infer<typeof mujtahidUpdateSchema>;

export const mujtahidRepRecordSchema = z
  .object({
    id: z.string(),
    name: z.string().min(1),
    mujtahid_id: z.string(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .strict();

export type MujtahidRep = z.infer<typeof mujtahidRepRecordSchema>;
export const mujtahidRepListSchema = z.array(mujtahidRepRecordSchema);

export const mujtahidRepInsertSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().min(1),
    mujtahid_id: z.string().min(1),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .strict();

export type MujtahidRepInsert = z.infer<typeof mujtahidRepInsertSchema>;
export const mujtahidRepUpdateSchema = mujtahidRepInsertSchema.partial();
export type MujtahidRepUpdate = z.infer<typeof mujtahidRepUpdateSchema>;

export const wakalaTypeRecordSchema = z
  .object({
    id: z.string(),
    mujtahid_representative_id: z.string(),
    obligation_type_id: z.string(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .strict();

export type WakalaType = z.infer<typeof wakalaTypeRecordSchema>;
export const wakalaTypeListSchema = z.array(wakalaTypeRecordSchema);

export const wakalaTypeInsertSchema = z
  .object({
    id: z.string().optional(),
    mujtahid_representative_id: z.string().min(1),
    obligation_type_id: z.string().min(1),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .strict();

export type WakalaTypeInsert = z.infer<typeof wakalaTypeInsertSchema>;
export const wakalaTypeUpdateSchema = wakalaTypeInsertSchema.partial();
export type WakalaTypeUpdate = z.infer<typeof wakalaTypeUpdateSchema>;

export const obligationDistributionRecordSchema = z
  .object({
    id: z.string(),
    name: z.string().min(1),
    percentage: z.number().min(0).max(100),
    wakala_type_id: z.string(),
    type: z.enum(["Liability", "Income"]),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .strict();

export type ObligationDistribution = z.infer<typeof obligationDistributionRecordSchema>;
export const obligationDistributionListSchema = z.array(obligationDistributionRecordSchema);

export const obligationDistributionInsertSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().min(1),
    percentage: z.number().min(0).max(100),
    wakala_type_id: z.string().min(1),
    type: z.enum(["Liability", "Income"]),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .strict();

export type ObligationDistributionInsert = z.infer<typeof obligationDistributionInsertSchema>;
export const obligationDistributionUpdateSchema = obligationDistributionInsertSchema.partial();
export type ObligationDistributionUpdate = z.infer<typeof obligationDistributionUpdateSchema>;

export const obligationCollectionRecordSchema = z
  .object({
    id: z.string(),
    receipt_no: z.string(),
    received_date: z.string(),
    sender_id: z.string(),
    reference_id: z.string().nullable().optional(),
    amount: z.number().min(0),
    currency_id: z.string(),
    payment_mode: z.enum(["Cash", "Online"]),
    obligation_type_id: z.string(),
    mujtahid_representative_id: z.string(),
    received_by: z.string(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
    deletedAt: z.string().nullable().optional(),
    deletedBy: z.string().nullable().optional(),
    deletionReason: z.string().nullable().optional(),
    restoredAt: z.string().nullable().optional(),
    restoredBy: z.string().nullable().optional(),
    deletedWithCascade: z.boolean().nullable().optional(),
  })
  .strict();

export type ObligationCollection = z.infer<typeof obligationCollectionRecordSchema>;
export const obligationCollectionListSchema = z.array(obligationCollectionRecordSchema);

export const obligationCollectionInsertSchema = z
  .object({
    id: z.string().optional(),
    receipt_no: z.string().min(1),
    received_date: z.string().min(1),
    sender_id: z.string().min(1),
    reference_id: z.string().nullable().optional(),
    amount: z.number().min(0),
    currency_id: z.string().min(1),
    payment_mode: z.enum(["Cash", "Online"]),
    obligation_type_id: z.string().min(1),
    mujtahid_representative_id: z.string().min(1),
    received_by: z.string().min(1),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .strict();

export type ObligationCollectionInsert = z.infer<typeof obligationCollectionInsertSchema>;
export const obligationCollectionUpdateSchema = obligationCollectionInsertSchema.partial();
export type ObligationCollectionUpdate = z.infer<typeof obligationCollectionUpdateSchema>;

export function isObligationCollectionDeleted(collection: { deletedAt?: string | null }): boolean {
  return Boolean(collection.deletedAt);
}

export function filterActiveObligationCollections<T extends { deletedAt?: string | null }>(
  collections: T[],
): T[] {
  return collections.filter((c) => !isObligationCollectionDeleted(c));
}

/** Tenant-scoped object key for the obligations invoice template. */
export const INVOICE_TEMPLATE_OBJECT_KEY = "mms_invoice_template";

/** Obligations module manifest — aligns with globle1 universal module architecture. */
export const OBLIGATIONS_MODULE_MANIFEST = {
  moduleId: "obligations",
  entityType: "ObligationCollection",
  collectionKey: "obligation_collections",
  settingsObjectKey: "obligations_settings",
  columnPreferencesObjectKey: "obligations_user_column_preferences",
  restBasePath: "/api/obligations",
  analyticsCategory: "obligations",
  tiers: ["work", "reports", "setup"] as const,
  setupSubTabs: ["wakala", "numbering", "invoice_template"] as const,
  softDelete: {
    workExcludesDeleted: true,
    reportsIncludeDeleted: false,
    exportsIncludeDeleted: false,
    captureDeletionReason: false,
    retentionDays: null,
  },
  permissions: {
    read: "obligations.read",
    write: "obligations.write",
    delete: "obligations.delete",
    setupView: "configuration.view",
    setupWrite: "settings.global.write",
    export: "obligations.read",
    reports: "obligations.read",
  } satisfies Record<string, Permission>,
  work: {
    directoryViews: ["summary", "collections"] as const,
    bulkActions: ["delete"] as const,
  },
  defaultPageSize: 12,
  maxPageSize: 100,
} as const;

export type ObligationsModuleTier = (typeof OBLIGATIONS_MODULE_MANIFEST.tiers)[number];
