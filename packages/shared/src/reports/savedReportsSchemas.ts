import { z } from "zod";

export * from "../schemas/savedReports.dto.js";
import {
  CONTACTS_SAVED_REPORT_CATEGORY,
  genericSavedReportCategorySchema,
} from "../schemas/savedReports.dto.js";

/** Validates a persisted generic saved-report preset returned by the API. */
export const genericSavedReportSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  category: z.union([genericSavedReportCategorySchema, z.literal(CONTACTS_SAVED_REPORT_CATEGORY)]),
  filters: z.record(z.string(), z.unknown()),
  lastRun: z.iso.datetime(),
  createdBy: z.string().min(1),
  createdByName: z.string(),
  createdAt: z.iso.datetime(),
});

/** A personal saved-report preset containing report logic rather than report data. */
export type GenericSavedReport = z.infer<typeof genericSavedReportSchema>;

/** Validates the category query required by generic saved-report operations. */
export const genericSavedReportListQuerySchema = z.object({
  category: genericSavedReportCategorySchema,
});

/** Validates route parameters identifying a generic saved-report preset. */
export const genericSavedReportIdParamsSchema = z.object({
  id: z.string().min(1),
});
