import { deriveWorkshopPhase, normalizeWorkshopStatus, type WorkshopEvent } from "@mms/shared";
import type { workshopEvents } from "../schema.js";

export type WorkshopEventRow = typeof workshopEvents.$inferSelect;

export const iso = (value: Date | null): string | null => (value ? value.toISOString() : null);

/**
 * Maps a row to the public record.
 *
 * `today` is the **workspace business day** (never the browser's): the derived phase
 * (`registration_open` / `registration_closed` / `ongoing` / `finished` / `archived`) is a server
 * decision, so two devices in different timezones cannot disagree about a workshop's state.
 */
export function workshopRowToRecord(
  row: WorkshopEventRow,
  participantCount: number,
  today: string,
): WorkshopEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    startDate: row.startDate,
    endDate: row.endDate,
    registrationDeadline: row.registrationDeadline,
    capacity: row.capacity,
    fee: row.fee === null ? null : Number(row.fee),
    programId: row.programId,
    subjectId: row.subjectId,
    minAttendancePct: row.minAttendancePct === null ? null : Number(row.minAttendancePct),
    minScorePct: row.minScorePct === null ? null : Number(row.minScorePct),
    participantCount,
    waitlistEnabled: row.waitlistEnabled,
    status: normalizeWorkshopStatus(row.status),
    phase: deriveWorkshopPhase(
      {
        status: row.status,
        startDate: row.startDate,
        endDate: row.endDate,
        registrationDeadline: row.registrationDeadline,
        deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
      },
      { today },
    ),
    deletedAt: iso(row.deletedAt),
    deletedBy: row.deletedBy,
    deletionReason: row.deletionReason,
    restoredAt: iso(row.restoredAt),
    restoredBy: row.restoredBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Money is stored as numeric(12,2); `undefined` = untouched. */
export const feeValue = (fee: number | null | undefined): string | null | undefined =>
  fee === undefined ? undefined : fee === null ? null : fee.toFixed(2);

/** Percent criteria travel as numbers and are stored as numeric(5,2); `undefined` = untouched. */
export const pctValue = (value: number | null | undefined): string | null | undefined =>
  value === undefined ? undefined : value === null ? null : value.toFixed(2);
