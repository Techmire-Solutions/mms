/** IAS 29 settings, run and request DTOs for `/api/accounting/hyperinflation*`. */
import { z } from "zod";
import { isoDateSchema } from "../core/isoDateSchema.js";

export const hyperinflationSettingsSchema = z
  .object({
    enabled: z.boolean(),
    /** Gain/loss on net monetary position account (IAS 29.27–28). */
    netMonetaryAccountId: z.string().trim().min(1).nullable(),
    /** First reporting date the functional currency is hyperinflationary. */
    appliesFrom: isoDateSchema.nullable(),
    /** General price index used (e.g. "CPI — national statistics office"). */
    indexName: z.string().trim().max(200).default(""),
    updatedAt: z.string().optional(),
  })
  .strict()
  .refine((settings) => !settings.enabled || settings.netMonetaryAccountId, {
    message: "accounting.validation.netMonetaryAccount",
    path: ["netMonetaryAccountId"],
  });

export type HyperinflationSettings = z.infer<typeof hyperinflationSettingsSchema>;

export const DEFAULT_HYPERINFLATION_SETTINGS: HyperinflationSettings = {
  enabled: false,
  netMonetaryAccountId: null,
  appliesFrom: null,
  indexName: "",
};

export const ias29LineSchema = z
  .object({
    accountId: z.string(),
    accountCode: z.string(),
    accountName: z.string(),
    carrying: z.string(),
    restated: z.string(),
    adjustment: z.string(),
  })
  .strict();

export const ias29RunSchema = z
  .object({
    id: z.string(),
    restatementDate: isoDateSchema,
    status: z.enum(["preview", "posted"]),
    closingIndex: z.string(),
    netMonetaryResult: z.string(),
    entryId: z.string().nullable(),
    reversalEntryId: z.string().nullable(),
    lines: z.array(ias29LineSchema),
    createdAt: z.string().optional(),
    createdBy: z.string().nullable().optional(),
  })
  .strict();

export type Ias29Run = z.infer<typeof ias29RunSchema>;

/** Body of `POST /api/accounting/ias29-restatements[/preview]`. */
export const ias29RequestSchema = z.object({ restatementDate: isoDateSchema }).strict();
