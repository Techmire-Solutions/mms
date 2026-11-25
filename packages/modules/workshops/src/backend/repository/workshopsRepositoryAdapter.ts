import type { WorkshopsRepository } from "./workshopsRepository.js";
import {
  findWorkshopById,
  insertWorkshop,
  listWorkshopsPage,
  restoreWorkshop,
  softDeleteWorkshops,
  updateWorkshop,
} from "../repository/workshopEventsRepository.js";
import {
  registerParticipant,
  registerParticipants,
  withdrawParticipant,
} from "../repository/workshopRegistrationRepository.js";
import {
  aggregateWorkshopsMetrics,
  loadWorkshopDetail,
} from "../repository/workshopActivityRepository.js";
import { saveAttendanceDay, saveScores } from "../repository/workshopActivityWriteRepository.js";
import {
  loadCompletionInputs,
  loadReportFacts,
  loadWorkshopPreferences,
  saveWorkshopPreferences,
} from "../repository/workshopCompletionRepository.js";
import { findWorkspaceTimezone } from "@mms/db";

/** Drizzle-backed {@link WorkshopsRepository}. */
export const workshopsRepository: WorkshopsRepository = {
  listWorkshopsPage,
  findWorkshopById,
  loadWorkshopDetail,
  insertWorkshop,
  updateWorkshop,
  softDeleteWorkshops,
  restoreWorkshop,
  registerParticipant,
  registerParticipants,
  withdrawParticipant,
  aggregateWorkshopsMetrics,
  findWorkspaceTimezone,
  loadCompletionInputs,
  loadReportFacts,
  saveAttendanceDay,
  saveScores,
  loadWorkshopPreferences,
  saveWorkshopPreferences,
};
