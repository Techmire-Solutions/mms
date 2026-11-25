import { z } from "zod";
import { isoDateSchema } from "../core/isoDateSchema.js";

const reasonSchema = z.string().trim().min(3, "Give a reason").max(500);
const idSchema = z.string().trim().min(1).max(64);

/** Move every live student of a section into another section of the same class, then close it. */
export const sectionMergeBodySchema = z
  .object({ targetSectionId: idSchema, effectiveOn: isoDateSchema, reason: reasonSchema })
  .strict();
export type SectionMergeBody = z.infer<typeof sectionMergeBodySchema>;

/** Create a new section in the same class and move the chosen students into it. */
export const sectionSplitBodySchema = z
  .object({
    name: z.string().trim().min(1, "Section name is required").max(50),
    capacity: z.coerce.number().int().min(1).max(1000),
    enrollmentIds: z.array(idSchema).min(1, "Choose at least one student").max(500),
    effectiveOn: isoDateSchema,
    reason: reasonSchema,
  })
  .strict();
export type SectionSplitBody = z.infer<typeof sectionSplitBodySchema>;

/** Close an empty section from a date (history is kept). */
export const sectionCloseBodySchema = z
  .object({ effectiveOn: isoDateSchema, reason: reasonSchema })
  .strict();
export type SectionCloseBody = z.infer<typeof sectionCloseBodySchema>;

/** What a merge / split / close changed. */
export const sectionOperationResultSchema = z
  .object({ sectionId: z.string(), moved: z.number().int().nonnegative() })
  .strict();
export type SectionOperationResult = z.infer<typeof sectionOperationResultSchema>;

/**
 * Seats missing in the target for a merge (0 when everyone fits). Capacity 0 counts as no seats,
 * matching `remainingSeats`.
 */
export function sectionMergeShortfall(
  movingStudents: number,
  target: { capacity?: number | null; enrolled?: number | null },
): number {
  const free = Math.max(0, (target.capacity ?? 0) - (target.enrolled ?? 0));
  return Math.max(0, movingStudents - free);
}
