import { z } from "zod";
import { isoDateSchema } from "../core/isoDateSchema.js";
import { addIsoDays } from "../attendance/academicCalendar.js";
import { withdrawalBillingOutcomeSchema } from "../enrollments/enrollmentOperations.js";

const reasonSchema = z.string().trim().min(3, "Give a reason").max(500);

/** Cancel a session: its live enrollments are cancelled and later unpaid invoices voided. */
export const sessionCancelBodySchema = z.object({ reason: reasonSchema }).strict();
export type SessionCancelBody = z.infer<typeof sessionCancelBodySchema>;

/** Move a not-yet-started session: start and end shift by the same number of days. */
export const sessionPostponeBodySchema = z
  .object({ startDate: isoDateSchema, reason: reasonSchema })
  .strict();
export type SessionPostponeBody = z.infer<typeof sessionPostponeBodySchema>;

export const sessionCancelResultSchema = z
  .object({ ended: z.number().int().nonnegative(), billing: withdrawalBillingOutcomeSchema })
  .strict();
export type SessionCancelResult = z.infer<typeof sessionCancelResultSchema>;

/** One entry of the session activity timeline (read-only merge of dated events). */
export const sessionActivityItemSchema = z
  .object({
    /** Business date (YYYY-MM-DD) the change took effect. */
    on: z.string(),
    kind: z.string(),
    title: z.string(),
    detail: z.string().nullable(),
    actor: z.string().nullable(),
  })
  .strict();
export type SessionActivityItem = z.infer<typeof sessionActivityItemSchema>;

const dayNumber = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / 86_400_000;

/** New start/end for a postponed session: the end moves by the same number of days as the start. */
export function postponedSessionDates(
  current: { startDate?: string | null; endDate?: string | null },
  newStart: string,
): { startDate: string; endDate: string | null } {
  const start = current.startDate?.slice(0, 10);
  const end = current.endDate?.slice(0, 10) || null;
  if (!start || !end) return { startDate: newStart, endDate: end };
  return { startDate: newStart, endDate: addIsoDays(end, dayNumber(newStart) - dayNumber(start)) };
}
