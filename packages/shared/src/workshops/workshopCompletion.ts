import { z } from "zod";
import { isoDateSchema, isoUtcTimestampSchema } from "../core/isoDateSchema.js";
import { WORKSHOP_PARTICIPANT_STATUSES } from "./workshopsRecords.js";

/** Why a participant does not (yet) meet the workshop's completion rule. */
export const WORKSHOP_COMPLETION_SHORTFALLS = [
  "attendance_none",
  "attendance_unknown",
  "attendance_below",
  "score_missing",
  "score_below",
] as const;
export type WorkshopCompletionShortfall = (typeof WORKSHOP_COMPLETION_SHORTFALLS)[number];

/** Completion statuses are exactly the participant statuses; one tuple cannot drift from the other. */
export const WORKSHOP_COMPLETION_STATUSES = WORKSHOP_PARTICIPANT_STATUSES;
export type WorkshopCompletionStatus = (typeof WORKSHOP_COMPLETION_STATUSES)[number];

/** A workshop's completion criteria; a null minimum means that criterion is not used. */
export interface WorkshopCompletionCriteria {
  minAttendancePct: number | null;
  minScorePct: number | null;
}

/** Facts for one participant, measured over the workshop days that have already happened. */
export interface WorkshopCompletionFacts {
  /** Workshop days up to today. */
  countableDays: number;
  /** Of those, days marked present or late. */
  presentDays: number;
  /** Sum of the participant's scores and of their maximums (0 / 0 when no score lines). */
  scoreTotal: number;
  scoreMax: number;
}

/** Exact percentage used for threshold comparisons; display rounds it. */
const percent = (part: number, whole: number): number | null =>
  whole > 0 ? (part / whole) * 100 : null;

const rounded = (value: number | null): number | null =>
  value === null ? null : Math.round(value * 10) / 10;

/**
 * Completion rule for a participation certificate.
 *
 * Every configured minimum must hold, and attending at least one day is always required — a
 * certificate of participation needs participation even when no minimum is set. `attended` means
 * present at least once but short of a criterion (incomplete); `registered` means never present
 * (no-show).
 *
 * Correctness details the audit pinned down:
 *  - thresholds compare the **unrounded** ratio (59.96% must not round up to a passing 60.0%);
 *  - `countableDays === 0` (no start date, or the workshop has not begun) is never completable —
 *    otherwise a dateless workshop with one orphan check-in would report `completed`;
 *  - a non-null minimum of `0` is a criterion that always passes (not "unused").
 */
export function evaluateWorkshopCompletion(
  facts: WorkshopCompletionFacts,
  criteria: WorkshopCompletionCriteria,
): {
  status: WorkshopCompletionStatus;
  shortfalls: WorkshopCompletionShortfall[];
  attendancePct: number | null;
  scorePct: number | null;
} {
  const attendancePct = percent(facts.presentDays, facts.countableDays);
  const scorePct = percent(facts.scoreTotal, facts.scoreMax);
  const shortfalls: WorkshopCompletionShortfall[] = [];

  if (facts.presentDays === 0) shortfalls.push("attendance_none");
  // No countable day means there is no attendance denominator: never claim completion.
  if (facts.countableDays === 0 && !shortfalls.includes("attendance_unknown")) {
    shortfalls.push("attendance_unknown");
  }
  const minAttendance = criteria.minAttendancePct;
  if (minAttendance !== null) {
    if (attendancePct === null) {
      if (!shortfalls.includes("attendance_unknown")) shortfalls.push("attendance_unknown");
    } else if (attendancePct < minAttendance) {
      shortfalls.push("attendance_below");
    }
  }
  const minScore = criteria.minScorePct;
  if (minScore !== null) {
    // A 0% minimum is satisfied by "no score lines at all" (0/0); only a positive minimum needs
    // actual scores to evaluate.
    if (scorePct === null) {
      if (minScore > 0) shortfalls.push("score_missing");
    } else if (scorePct < minScore) {
      shortfalls.push("score_below");
    }
  }

  const status: WorkshopCompletionStatus =
    shortfalls.length === 0 ? "completed" : facts.presentDays > 0 ? "attended" : "registered";
  return { status, shortfalls, attendancePct: rounded(attendancePct), scorePct: rounded(scorePct) };
}

export const workshopCompletionRowSchema = z
  .object({
    participantId: z.string(),
    contactName: z.string(),
    attendancePct: z.number().nullable(),
    scorePct: z.number().nullable(),
    status: z.enum(WORKSHOP_COMPLETION_STATUSES),
    shortfalls: z.array(z.enum(WORKSHOP_COMPLETION_SHORTFALLS)),
    completedAt: isoUtcTimestampSchema.nullable(),
    certificateIssuedAt: isoUtcTimestampSchema.nullable(),
  })
  .strict();
export type WorkshopCompletionRow = z.infer<typeof workshopCompletionRowSchema>;

/** Issue certificates to completed participants (every completed one when the list is empty). */
export const workshopCertificatesBodySchema = z
  .object({ participantIds: z.array(z.string().trim().min(1).max(64)).max(500).default([]) })
  .strict();
export type WorkshopCertificatesBody = z.infer<typeof workshopCertificatesBodySchema>;

const pctSchema = z.number().min(0).max(100).nullable();

/** Setup defaults copied into new workshops' completion criteria. */
export const workshopPreferencesSchema = z
  .object({ defaultMinAttendancePct: pctSchema, defaultMinScorePct: pctSchema })
  .strict();
export type WorkshopPreferences = z.infer<typeof workshopPreferencesSchema>;

export const DEFAULT_WORKSHOP_PREFERENCES: WorkshopPreferences = {
  defaultMinAttendancePct: null,
  defaultMinScorePct: null,
};

/** One workshop's line in the Reports tier. */
export const workshopReportRowSchema = z
  .object({
    workshopId: z.string(),
    title: z.string(),
    startDate: isoDateSchema.nullable(),
    endDate: isoDateSchema.nullable(),
    participants: z.number().int(),
    attendancePct: z.number().nullable(),
    /** Seated participants ÷ capacity; null when the workshop has no capacity. */
    seatUtilizationPct: z.number().nullable(),
    /** Completed participants ÷ participants; null when nobody registered. */
    completionPct: z.number().nullable(),
    completed: z.number().int(),
    certificates: z.number().int(),
  })
  .strict();
export type WorkshopReportRow = z.infer<typeof workshopReportRowSchema>;
