import type { AttendanceEscalationRepository } from "./attendanceEscalationPort.js";

export type { AbsenceAlertRow } from "./attendanceEscalationPort.js";
import {
  listAbsenceAlerts,
  listClassMarkedDays,
  listCountableMarks,
  markAbsenceAlertNotified,
  resolveAbsenceAlert,
  upsertAbsenceAlert,
} from "../../db/repositories/attendanceEscalationRepository.js";

/** Drizzle-backed adapter for {@link AttendanceEscalationRepository}. */
export const attendanceEscalationRepository: AttendanceEscalationRepository = {
  listClassMarkedDays,
  listCountableMarks,
  upsertAbsenceAlert,
  markAbsenceAlertNotified,
  listAbsenceAlerts,
  resolveAbsenceAlert,
};
