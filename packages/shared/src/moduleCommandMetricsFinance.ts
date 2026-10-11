import { z } from "zod";

export const obligationsCommandMetricsSnapshotSchema = z
  .object({
    total: z.number().int().nonnegative(),
    totalAmount: z.number(),
    cash: z.number(),
    online: z.number(),
    newThisPeriod: z.number().int().nonnegative(),
    obligationTypes: z.number().int().nonnegative(),
  })
  .strict();

export type ObligationsCommandMetricsSnapshot = z.infer<
  typeof obligationsCommandMetricsSnapshotSchema
>;

export const accountingCommandMetricsSnapshotSchema = z
  .object({
    totalEntries: z.number().int().nonnegative(),
    posted: z.number().int().nonnegative(),
    draft: z.number().int().nonnegative(),
    activeAccounts: z.number().int().nonnegative(),
    inactiveAccounts: z.number().int().nonnegative(),
    newThisPeriod: z.number().int().nonnegative(),
    postedVolume: z.number().nonnegative(),
    revenue: z.number(),
    expenses: z.number(),
    surplus: z.number(),
    assets: z.number(),
    liabilities: z.number(),
  })
  .strict();

export type AccountingCommandMetricsSnapshot = z.infer<
  typeof accountingCommandMetricsSnapshotSchema
>;

export const hasanatCommandMetricsSnapshotSchema = z
  .object({
    totalStock: z.number().int().nonnegative(),
    available: z.number().int().nonnegative(),
    distributed: z.number().int().nonnegative(),
    redeemed: z.number().int().nonnegative(),
    active: z.number().int().nonnegative(),
    returned: z.number().int().nonnegative(),
    denominations: z.number().int().nonnegative(),
    totalPointsDistributed: z.number().nonnegative(),
    pointsThisWeek: z.number().nonnegative(),
    pointsLastWeek: z.number().nonnegative(),
  })
  .strict();

export type HasanatCommandMetricsSnapshot = z.infer<typeof hasanatCommandMetricsSnapshotSchema>;
