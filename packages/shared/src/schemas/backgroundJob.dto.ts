import { z } from "zod";
import { deepSanitizeStrings } from "./sanitize.js";

const progressSchema = z
  .object({
    current: z.number().int().min(0),
    total: z.number().int().min(0),
  })
  .strict();

/** Validation schema for background job creation and status update payloads. */
export const backgroundJobUpsertSchema = z.preprocess(
  deepSanitizeStrings,
  z
    .object({
      id: z.string().min(1),
      moduleId: z.string().min(1).max(64),
      kind: z.string().min(1).max(64),
      status: z.enum(["running", "completed", "failed"]),
      label: z.string().min(1).max(500),
      progress: progressSchema.optional(),
      error: z.string().max(500).optional(),
      hasDownload: z.boolean().optional(),
      createdAt: z.string().min(1),
      completedAt: z.string().optional(),
    })
    .strict(),
);
