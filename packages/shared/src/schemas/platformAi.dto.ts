import { z } from "zod";

export const platformAiActionTypeSchema = z.enum(["navigate", "filter", "inspect", "refresh"]);
export type PlatformAiActionType = z.infer<typeof platformAiActionTypeSchema>;

export const platformAiSuggestionSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    actionType: platformAiActionTypeSchema,
    target: z.string().optional(),
    payload: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export type PlatformAiSuggestion = z.infer<typeof platformAiSuggestionSchema>;

export const platformAiContextSchema = z
  .object({
    currentRoute: z.string().optional(),
    activeSubdomain: z.string().optional(),
    telemetrySummary: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export type PlatformAiContext = z.infer<typeof platformAiContextSchema>;

export const platformAiQueryRequestSchema = z
  .object({
    prompt: z.string().min(1).max(2000),
    context: platformAiContextSchema.optional(),
  })
  .strict();
export type PlatformAiQueryRequest = z.infer<typeof platformAiQueryRequestSchema>;

export const platformAiQueryResponseSchema = z
  .object({
    success: z.boolean(),
    analysis: z.string(),
    suggestions: z.array(platformAiSuggestionSchema),
    confidence: z.number().min(0).max(1).optional(),
    latencyMs: z.number().optional(),
  })
  .strict();
export type PlatformAiQueryResponse = z.infer<typeof platformAiQueryResponseSchema>;
