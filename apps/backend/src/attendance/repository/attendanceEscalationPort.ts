type EscalationStore = typeof import("../../db/repositories/attendanceEscalationRepository.js");

export type {
  AbsenceAlertRow,
  ClassDayRow,
  StudentMarkRow,
  UpsertAbsenceAlertInput,
} from "../../db/repositories/attendanceEscalationRepository.js";

/**
 * Port for the chronic-absence scan and its alerts, so the escalation use case never imports
 * `db/repositories` directly (SYSTEM_ARCHITECTURE.md §5).
 */
export interface AttendanceEscalationRepository {
  listClassMarkedDays: EscalationStore["listClassMarkedDays"];
  listCountableMarks: EscalationStore["listCountableMarks"];
  upsertAbsenceAlert: EscalationStore["upsertAbsenceAlert"];
  markAbsenceAlertNotified: EscalationStore["markAbsenceAlertNotified"];
  listAbsenceAlerts: EscalationStore["listAbsenceAlerts"];
  resolveAbsenceAlert: EscalationStore["resolveAbsenceAlert"];
}
