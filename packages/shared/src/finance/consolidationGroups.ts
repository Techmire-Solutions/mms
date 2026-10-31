/**
 * Platform consolidation groups: which workspaces consolidate, in what
 * presentation currency, at what ownership, with which translation rates and
 * intercompany accounts.
 */
import { z } from "zod";
import { isoDateSchema } from "../core/isoDateSchema.js";
import { currencyCodeSchema, exchangeRateValueSchema } from "../money/moneySchemas.js";
import type { ConsolidatedTrialBalance, TranslatedMember } from "./consolidationTranslation.js";

export const consolidationMemberSchema = z
  .object({
    memberSubdomain: z.string().trim().min(1).max(63),
    /** Parent's ownership, 0–100 (the parent itself is 100). */
    ownershipPercent: z.number().min(0).max(100),
    isParent: z.boolean().default(false),
    /** Member functional → presentation; omitted when the currencies match. */
    closingRate: exchangeRateValueSchema.optional(),
    averageRate: exchangeRateValueSchema.optional(),
    historicalRate: exchangeRateValueSchema.optional(),
  })
  .strict();

export type ConsolidationMember = z.infer<typeof consolidationMemberSchema>;

export const consolidationGroupSchema = z
  .object({
    id: z.string(),
    name: z.string().trim().min(1).max(120),
    presentationCurrency: currencyCodeSchema,
    members: z.array(consolidationMemberSchema).max(50),
    /** Account codes holding intercompany balances; eliminated on consolidation. */
    intercompanyAccountCodes: z.array(z.string().trim().min(1).max(50)).max(100),
    updatedAt: z.string().optional(),
  })
  .strict();

export type ConsolidationGroup = z.infer<typeof consolidationGroupSchema>;

/** Body of `PUT /api/platform/consolidation/groups/:id`. */
export const consolidationGroupPutSchema = consolidationGroupSchema
  .omit({ id: true, updatedAt: true })
  .strict()
  .refine((group) => group.members.filter((member) => member.isParent).length === 1, {
    message: "consolidation.validation.oneParent",
    path: ["members"],
  })
  .refine(
    (group) =>
      new Set(group.members.map((member) => member.memberSubdomain)).size === group.members.length,
    { message: "consolidation.validation.duplicateMember", path: ["members"] },
  );

export type ConsolidationGroupPut = z.infer<typeof consolidationGroupPutSchema>;

export const consolidationReportQuerySchema = z
  .object({ dateFrom: isoDateSchema, dateTo: isoDateSchema })
  .strict()
  .refine((query) => query.dateFrom <= query.dateTo, {
    message: "consolidation.validation.dateRange",
    path: ["dateTo"],
  });

export type ConsolidationReportQuery = z.infer<typeof consolidationReportQuerySchema>;

export interface ConsolidationReport {
  group: ConsolidationGroup;
  dateFrom: string;
  dateTo: string;
  members: TranslatedMember[];
  consolidated: ConsolidatedTrialBalance;
}
