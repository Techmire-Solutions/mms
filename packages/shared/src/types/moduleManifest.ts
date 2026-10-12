import { z } from "zod";

/**
 * Zod schema defining the soft-delete configuration block for module manifests (mms-module-architecture.md §6).
 */
export const manifestSoftDeleteSchema = z
  .object({
    workExcludesDeleted: z.boolean(),
    reportsIncludeDeleted: z.boolean(),
    exportsIncludeDeleted: z.boolean(),
    duplicatesIncludeDeleted: z.boolean().optional(),
    captureDeletionReason: z.boolean(),
    retentionDays: z.number().nullable().optional(),
  })
  .strict();

/** Manifest soft-delete configuration structure. */
export type ManifestSoftDeleteConfig = z.infer<typeof manifestSoftDeleteSchema>;
