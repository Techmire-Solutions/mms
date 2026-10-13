import { z } from "zod";

/** Max field keys accepted by `POST …/field-usage` batch routes. */
export const FIELD_USAGE_BATCH_MAX = 100;

/**
 * Batch body for module Setup field-usage counts.
 * Response: `{ counts: Record<string, number> }` with every requested key present.
 */
export const fieldUsageBatchBodySchema = z.object({
  fieldKeys: z.array(z.string().min(1).max(128)).min(1).max(FIELD_USAGE_BATCH_MAX),
});

export type FieldUsageBatchBody = z.infer<typeof fieldUsageBatchBodySchema>;

/** Single-key path params for `GET …/field-usage/:fieldKey`. */
export const fieldUsageParamsSchema = z.object({
  fieldKey: z.string().min(1).max(128),
});

export type FieldUsageParams = z.infer<typeof fieldUsageParamsSchema>;
