import { z } from "zod";
import { deepSanitizeStrings } from "./sanitize.js";

/** Batch resolve entity rows by id (globle2 §10). */
export const ENTITY_RESOLVE_MAX_IDS = 100;

const entityResolveBodyBaseSchema = z
  .object({
    ids: z.array(z.string().min(1).max(64)).max(ENTITY_RESOLVE_MAX_IDS),
  })
  .strict();

export const entityResolveBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, entityResolveBodyBaseSchema);

export const widgetQuerySchema = z
  .object({
    id: z.string().min(1).max(128),
    operation: z.enum(["count", "sum", "avg", "percentage"]),
    targetField: z.string().max(128).optional(),
    filterField: z.string().max(128).optional(),
    filterOperator: z.enum(["equals", "contains", "gt", "lt", "startsWith"]).optional(),
    filterValue: z.string().max(256).optional(),
    xAxisField: z.string().max(128).optional(),
    /** Extra AND filters (chart visualizer / multi-rule widgets). */
    filters: z
      .array(
        z
          .object({
            field: z.string().min(1).max(128),
            operator: z.enum(["equals", "contains", "gt", "lt", "startsWith"]).optional(),
            value: z.string().max(256),
          })
          .strict(),
      )
      .max(8)
      .optional(),
    /** Chart GROUP BY series cap (default 8; visualizer may request up to 50). */
    chartLimit: z.number().int().min(1).max(50).optional(),
  })
  .strict();

const widgetAggregatesBodyBaseSchema = z
  .object({
    widgets: z.array(widgetQuerySchema).max(32),
  })
  .strict();

export const widgetAggregatesBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, widgetAggregatesBodyBaseSchema);

/** Standard count endpoint response schema. */
export const countResponseSchema = z
  .object({
    count: z.number(),
  })
  .strict();

export type CountResponse = z.infer<typeof countResponseSchema>;

/** Standard widget aggregate result schema across all module dashboards. */
export const widgetAggregateResultSchema = z.object({
  value: z.number(),
  totalCount: z.number(),
  chartData: z.array(z.object({ name: z.string(), value: z.number() })),
});

export type WidgetAggregateResult = z.infer<typeof widgetAggregateResultSchema>;

/** Standard image upload response schema. */
export const imageUploadResponseSchema = z
  .object({
    url: z.string().min(1),
    purpose: z.string().optional(),
  })
  .strict();

export type ImageUploadResponse = z.infer<typeof imageUploadResponseSchema>;

/** Standard file attachment upload response schema. */
export const attachmentUploadResponseSchema = z
  .object({
    url: z.string().min(1),
    name: z.string().min(1),
    type: z.string().min(1),
    size: z.number().int().nonnegative(),
  })
  .strict();

export type AttachmentUploadResponse = z.infer<typeof attachmentUploadResponseSchema>;
