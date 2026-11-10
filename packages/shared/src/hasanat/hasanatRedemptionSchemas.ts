/**
 * Redemption/ledger serialization contracts — the append-only ledger read model, the atomic redeem
 * body and the reversal body. Split from `hasanatModuleManifest` to keep both under 300 lines.
 */

import { z } from "zod";
import { isoDateSchema } from "../core/isoDateSchema.js";

export const redemptionRecordSchema = z
  .object({
    id: z.string(),
    distributionId: z.string(),
    studentId: z.string().nullable().optional(),
    studentName: z.string().optional().default(""),
    reward: z.string().default(""),
    pointsUsed: z.number().default(0),
    /** `redeem` burns value; `reversal` corrects one redemption (append-only ledger). */
    kind: z.enum(["redeem", "reversal"]).default("redeem"),
    reversalOfId: z.string().nullable().optional(),
    date: z.string(),
    approvedByUserId: z.string().nullable().optional(),
    approvedBy: z.string().nullable().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .strict();

export const redemptionRecordInsertSchema = z
  .object({
    id: z.string().optional(),
    distributionId: z.string().min(1, "Distribution is required"),
    studentId: z.string().nullable().optional(),
    studentName: z.string().optional().default(""),
    reward: z.string().min(1, "Reward is required"),
    pointsUsed: z.number().positive("Points used must be greater than 0"),
    date: isoDateSchema,
    approvedByUserId: z.string().nullable().optional(),
    approvedBy: z.string().nullable().optional(),
  })
  .strict();

/** Ledger history query — bounded page, newest first, optional filters. */
export const hasanatLedgerListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
    kind: z.enum(["redeem", "reversal"]).optional(),
    studentId: z.string().min(1).max(64).optional(),
    distributionId: z.string().min(1).max(64).optional(),
  })
  .strict();

export const hasanatRedemptionsPageResponseSchema = z.object({
  redemptions: z.array(redemptionRecordSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  hasMore: z.boolean(),
});

export type Redemption = z.infer<typeof redemptionRecordSchema>;
export type RedemptionInsert = z.infer<typeof redemptionRecordInsertSchema>;
export const redemptionListSchema = z.array(redemptionRecordSchema);

/**
 * Body for the atomic `POST /api/hasanat/distributions/:id/redeem` action.
 *
 * The card id lives in the path; the server locks the card row, validates its value and writes the
 * ledger row plus the card status in one transaction. Clients must not model a redemption as
 * "insert ledger row, then update the card" — that flow can lose one write and double-spend.
 */
export const redeemCardBodySchema = z
  .object({
    reward: z.string().min(1, "Reward is required"),
    pointsUsed: z.number().int().positive("Points used must be greater than 0"),
    date: isoDateSchema,
    approvedByUserId: z.string().nullable().optional(),
    approvedBy: z.string().nullable().optional(),
    /** Idempotency key: replaying the same key returns the original redemption. */
    clientRequestId: z.string().min(8).max(64).nullable().optional(),
  })
  .strict();

export type RedeemCardBody = z.infer<typeof redeemCardBodySchema>;

/** Ledger correction: reverses one redemption without mutating it (append-only). */
export const reverseRedemptionBodySchema = z
  .object({
    reason: z.string().min(1).max(500),
  })
  .strict();

export type ReverseRedemptionBody = z.infer<typeof reverseRedemptionBodySchema>;
