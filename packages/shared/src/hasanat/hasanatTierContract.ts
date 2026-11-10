import { z } from "zod";

/** Student progression summary returned by `GET /api/hasanat/students/:id/summary`. */
export const hasanatTierSchema = z.object({
  key: z.string(),
  name: z.string(),
  minPoints: z.number(),
});

export const hasanatStudentAwardSchema = z.object({
  id: z.string(),
  tierKey: z.string(),
  tierName: z.string(),
  earnedSnapshot: z.number(),
  awardedAt: z.string(),
  revokedAt: z.string().nullable().optional(),
  revokedReason: z.string().nullable().optional(),
});

export const hasanatStudentSummarySchema = z.object({
  studentId: z.string(),
  earned: z.number(),
  balance: z.number(),
  redeemed: z.number(),
  tier: hasanatTierSchema,
  nextTier: hasanatTierSchema.nullable(),
  pointsToNext: z.number(),
  percentToNext: z.number(),
  awards: z.array(hasanatStudentAwardSchema),
});

export type HasanatTierDto = z.infer<typeof hasanatTierSchema>;
export type HasanatStudentSummaryDto = z.infer<typeof hasanatStudentSummarySchema>;

/** One per-student row of the Hasanat report (server read model, tier included). */
export const hasanatStudentReportRowSchema = z.object({
  studentId: z.string(),
  studentName: z.string(),
  className: z.string(),
  faculty: z.string(),
  earned: z.number(),
  balance: z.number(),
  redeemed: z.number(),
  tierKey: z.string(),
  tierName: z.string(),
  pointsToNext: z.number(),
  percentToNext: z.number(),
});

export const hasanatStudentReportResponseSchema = z.object({
  rows: z.array(hasanatStudentReportRowSchema),
  tiers: z.array(hasanatTierSchema),
});

export type HasanatStudentReportRowDto = z.infer<typeof hasanatStudentReportRowSchema>;
export type HasanatStudentReportResponseDto = z.infer<typeof hasanatStudentReportResponseSchema>;
