import {
  countWorkshopDays,
  evaluateWorkshopCompletion,
  type WorkshopCompletionRow,
} from "@mms/shared";

/**
 * The single computation from completion facts to the public rows.
 *
 * Evaluation, certificate issuance and the `→ completed` lifecycle transition all build their rows
 * here, so eligibility is always derived from the same rule and the same "countable days" math
 * (uncapped arithmetic, business-day capped) — the two diverged before and produced >100%
 * attendance and stale certificates.
 */
export interface WorkshopCompletionFactsInput {
  workshop: {
    startDate: string | null;
    endDate: string | null;
    minAttendancePct: number | null;
    minScorePct: number | null;
  };
  participants: ReadonlyArray<{
    id: string;
    contactName: string;
    completedAt: string | null;
    certificateIssuedAt: string | null;
  }>;
  presentDays: ReadonlyMap<string, number>;
  scores: ReadonlyMap<string, { total: number; max: number }>;
}

export function buildCompletionRows(
  inputs: WorkshopCompletionFactsInput,
  today: string,
): WorkshopCompletionRow[] {
  const countableDays = countWorkshopDays(
    inputs.workshop.startDate,
    inputs.workshop.endDate,
    today,
  );
  const criteria = {
    minAttendancePct: inputs.workshop.minAttendancePct,
    minScorePct: inputs.workshop.minScorePct,
  };
  return inputs.participants.map((participant) => {
    const score = inputs.scores.get(participant.id) ?? { total: 0, max: 0 };
    const result = evaluateWorkshopCompletion(
      {
        countableDays,
        presentDays: inputs.presentDays.get(participant.id) ?? 0,
        scoreTotal: score.total,
        scoreMax: score.max,
      },
      criteria,
    );
    // A certificate pins the participant to `completed`; the persistence primitive enforces the
    // same rule, so a later re-evaluation can never downgrade issued evidence.
    const status = participant.certificateIssuedAt ? "completed" : result.status;
    return {
      participantId: participant.id,
      contactName: participant.contactName,
      attendancePct: result.attendancePct,
      scorePct: result.scorePct,
      status,
      shortfalls: result.shortfalls,
      completedAt: participant.completedAt,
      certificateIssuedAt: participant.certificateIssuedAt,
    };
  });
}
