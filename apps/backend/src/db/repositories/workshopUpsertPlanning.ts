import type { WorkshopAttendanceStatus } from "@mms/shared";

/**
 * Planning helpers for the workshop check-in / score upserts.
 *
 * Split out so the ordering and de-duplication rules that keep concurrent saves safe are pure
 * functions with direct unit tests (`mms-structure-naming` §3, 300-line band).
 *
 * Why this exists
 * ---------------
 * Both saves are multi-row `INSERT … ON CONFLICT DO UPDATE` statements:
 *
 *  - PostgreSQL refuses to touch the same conflict target twice in one statement (`21000`,
 *    "ON CONFLICT DO UPDATE command cannot affect row a second time"). A payload that repeats a
 *    participant — or a participant+criterion — used to surface as a 500.
 *  - `ON CONFLICT DO UPDATE` locks the conflicting rows in the order the statement meets them, so
 *    two staff members saving the same roster in different orders could take those locks in
 *    opposite order and deadlock (`40P01`). A deterministic order removes the cycle.
 *
 * Mirrors `attendanceUpsert.ts` (`planAttendanceUpsert`), which fixed the same class of bug for the
 * academic attendance grid.
 */

export interface WorkshopMarkInput {
  participantId: string;
  status: WorkshopAttendanceStatus;
}

export interface WorkshopScoreInput {
  participantId: string;
  criterionName: string;
  score: number;
  maxScore: number;
  remarks?: string | null;
}

/** A normalized score line: `remarks` is always present (null when the caller omitted it). */
export type PlannedScoreLine = WorkshopScoreInput & { remarks: string | null };

/** Deterministic string order — locale-independent so every process sorts identically. */
function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function comparePair(left: readonly [string, string], right: readonly [string, string]): number {
  return compareText(left[0], right[0]) || compareText(left[1], right[1]);
}

/**
 * One check-in per participant for the day (the last mark in the payload wins), sorted by
 * participant id so concurrent saves acquire `workshop_attendance_participant_day_uidx` locks in
 * the same order.
 */
export function planAttendanceMarks(marks: readonly WorkshopMarkInput[]): WorkshopMarkInput[] {
  const byParticipant = new Map<string, WorkshopMarkInput>();
  for (const mark of marks) byParticipant.set(mark.participantId, mark);
  return [...byParticipant.values()].sort((left, right) =>
    compareText(left.participantId, right.participantId),
  );
}

/**
 * One score per (participant, criterion) — the last line wins — sorted by that pair so concurrent
 * saves acquire `workshop_scores_participant_criterion_uidx` locks in the same order.
 */
export function planScoreLines(lines: readonly WorkshopScoreInput[]): PlannedScoreLine[] {
  const byKey = new Map<string, WorkshopScoreInput>();
  for (const line of lines) byKey.set(`${line.participantId}\u0000${line.criterionName}`, line);
  return [...byKey.values()]
    .map((line) => ({ ...line, remarks: line.remarks ?? null }))
    .sort((left, right) =>
      comparePair(
        [left.participantId, left.criterionName],
        [right.participantId, right.criterionName],
      ),
    );
}
