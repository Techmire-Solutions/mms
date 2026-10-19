import { z } from "zod";
import { isoDateSchema } from "../core/isoDateSchema.js";
import type { Session } from "./sessionTypes.js";

/** What happens to each source enrollment in a promotion. */
export const PROMOTION_OUTCOMES = ["promote", "retain", "graduate", "leave"] as const;
export type PromotionOutcome = (typeof PROMOTION_OUTCOMES)[number];

/** Source enrollment status written for each outcome. */
export const PROMOTION_OUTCOME_STATUS = {
  promote: "promoted",
  retain: "retained",
  graduate: "graduated",
  leave: "left",
} as const satisfies Record<PromotionOutcome, string>;

const idSchema = z.string().trim().min(1).max(64);

export const sessionRolloverBodySchema = z
  .object({
    mode: z.enum(["duplicate", "promote"]),
    target: z
      .object({
        name: z.string().trim().min(1).max(200),
        startDate: isoDateSchema,
        endDate: isoDateSchema,
        categoryId: idSchema.optional(),
      })
      .strict()
      .refine((target) => target.endDate >= target.startDate, {
        message: "End date must be on or after the start date",
        path: ["endDate"],
      }),
    copy: z
      .object({
        fees: z.boolean().default(true),
        discounts: z.boolean().default(true),
        scholarships: z.boolean().default(true),
        workingDays: z.boolean().default(true),
        staff: z.boolean().default(true),
        calendar: z.boolean().default(false),
      })
      .strict(),
    /** Source class → source class whose copy the students move into next (null = graduate). */
    classMap: z
      .array(z.object({ sourceClassId: idSchema, nextClassId: idSchema.nullable() }).strict())
      .max(200)
      .default([]),
    /** Per-student overrides of the outcome the class map implies. */
    outcomes: z
      .array(z.object({ enrollmentId: idSchema, outcome: z.enum(PROMOTION_OUTCOMES) }).strict())
      .max(5000)
      .default([]),
  })
  .strict();
export type SessionRolloverBody = z.infer<typeof sessionRolloverBodySchema>;
export type SessionRolloverInput = z.input<typeof sessionRolloverBodySchema>;

export const SESSION_PROMOTION_RUN_STATUSES = ["queued", "running", "completed", "failed"] as const;

export const sessionRolloverRunSchema = z
  .object({
    id: z.string(),
    sourceSessionId: z.string(),
    targetSessionId: z.string().nullable(),
    mode: z.enum(["duplicate", "promote"]),
    status: z.enum(SESSION_PROMOTION_RUN_STATUSES),
    promoted: z.number().int(),
    retained: z.number().int(),
    graduated: z.number().int(),
    left: z.number().int(),
    error: z.string().nullable(),
    jobId: z.string().nullable(),
  })
  .strict();
export type SessionRolloverRun = z.infer<typeof sessionRolloverRunSchema>;

export const promotionPreviewRowSchema = z
  .object({
    enrollmentId: z.string(),
    studentName: z.string(),
    fromClassId: z.string(),
    outcome: z.enum(PROMOTION_OUTCOMES),
    toClassId: z.string().nullable(),
    problems: z.array(z.string()),
  })
  .strict();
export type PromotionPreviewRow = z.infer<typeof promotionPreviewRowSchema>;

/**
 * Default class map: each class moves to the next class of the same program in session order;
 * the last class of a program graduates (null).
 */
export function defaultPromotionClassMap(
  classes: readonly Pick<Session["classes"][number], "id" | "programId">[],
): { sourceClassId: string; nextClassId: string | null }[] {
  return classes.map((cls, index) => {
    const next = classes
      .slice(index + 1)
      .find((candidate) => (candidate.programId ?? "") === (cls.programId ?? ""));
    return { sourceClassId: cls.id, nextClassId: next?.id ?? null };
  });
}

/** Outcome + destination (source class id whose copy receives the student) for one enrollment. */
export function promotionOutcomeFor(
  enrollment: { id: string; classId: string },
  classMap: readonly { sourceClassId: string; nextClassId: string | null }[],
  overrides: ReadonlyMap<string, PromotionOutcome>,
): { outcome: PromotionOutcome; toSourceClassId: string | null } {
  const mapped = classMap.find((row) => row.sourceClassId === enrollment.classId);
  const outcome = overrides.get(enrollment.id) ?? (mapped?.nextClassId ? "promote" : "graduate");
  if (outcome === "promote") return { outcome, toSourceClassId: mapped?.nextClassId ?? null };
  if (outcome === "retain") return { outcome, toSourceClassId: enrollment.classId };
  return { outcome, toSourceClassId: null };
}
