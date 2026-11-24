import type { WorkshopStatus } from "./workshopLifecycle.js";
import type { WorkshopParticipantStatus } from "./workshopsRecords.js";

/**
 * The product's six registration states.
 *
 * Only `registered | attended | completed` are persisted on the participant row. Waitlisted,
 * no-show and cancelled are **derived**:
 *  - waitlisted → `waitlisted_at IS NOT NULL`
 *  - no_show → `registered` after the workshop is completed (books closed)
 *  - cancelled → the registration or workshop was archived, or the workshop was cancelled
 *
 * Keeping the derivation here means the UI can speak the six-state vocabulary without a second
 * status column (and without duplicating the precedence rules per component).
 */
export const WORKSHOP_REGISTRATION_STATES = [
  "registered",
  "waitlisted",
  "attended",
  "completed",
  "no_show",
  "cancelled",
] as const;
export type WorkshopRegistrationState = (typeof WORKSHOP_REGISTRATION_STATES)[number];

export interface WorkshopRegistrationStateInput {
  participantStatus: WorkshopParticipantStatus;
  waitlistedAt: string | null;
  workshopStatus: WorkshopStatus;
  participantDeletedAt?: string | null;
  workshopDeletedAt?: string | null;
}

export function resolveWorkshopRegistrationState(
  input: WorkshopRegistrationStateInput,
): WorkshopRegistrationState {
  if (
    input.participantDeletedAt ||
    input.workshopDeletedAt ||
    input.workshopStatus === "cancelled"
  ) {
    return "cancelled";
  }
  if (input.waitlistedAt) return "waitlisted";
  if (input.participantStatus === "completed") return "completed";
  if (input.participantStatus === "attended") return "attended";
  return input.workshopStatus === "completed" ? "no_show" : "registered";
}
