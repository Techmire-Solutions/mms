import { z } from "zod";

/** Why a participant does not (yet) meet the workshop's completion rule. */
export const WORKSHOP_COMPLETION_SHORTFALLS = [
  "attendance_none",
  "attendance_unknown",
  "attendance_below",
  "score_missing",
  "score_below",
] as const;
export type WorkshopCompletionShortfall = (typeof WORKSHOP_COMPLETION_SHORTFALLS)[number];

export const WORKSHOP_COMPLETION_STATUSES = ["completed", "attended", "registered"] as const;
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

const percent = (part: number, whole: number): number | null =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;

/**
 * Completion rule for a participation certificate. Every configured minimum must hold, and
 * attending at least one day is always required — a certificate of participation needs
 * participation even when no attendance minimum is set. `attended` means present at least
 * once but not (yet) completing; `registered` means never present.
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
  const minAttendance = criteria.minAttendancePct;
  if (minAttendance !== null && minAttendance > 0) {
    if (attendancePct === null) shortfalls.push("attendance_unknown");
    else if (attendancePct < minAttendance) shortfalls.push("attendance_below");
  }
  const minScore = criteria.minScorePct;
  if (minScore !== null && minScore > 0) {
    if (scorePct === null) shortfalls.push("score_missing");
    else if (scorePct < minScore) shortfalls.push("score_below");
  }

  const status: WorkshopCompletionStatus =
    shortfalls.length === 0 ? "completed" : facts.presentDays > 0 ? "attended" : "registered";
  return { status, shortfalls, attendancePct, scorePct };
}

export const workshopCompletionRowSchema = z
  .object({
    participantId: z.string(),
    contactName: z.string(),
    attendancePct: z.number().nullable(),
    scorePct: z.number().nullable(),
    status: z.enum(WORKSHOP_COMPLETION_STATUSES),
    shortfalls: z.array(z.enum(WORKSHOP_COMPLETION_SHORTFALLS)),
    completedAt: z.string().nullable(),
    certificateIssuedAt: z.string().nullable(),
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
    startDate: z.string().nullable(),
    endDate: z.string().nullable(),
    participants: z.number().int(),
    attendancePct: z.number().nullable(),
    completed: z.number().int(),
    certificates: z.number().int(),
  })
  .strict();
export type WorkshopReportRow = z.infer<typeof workshopReportRowSchema>;
