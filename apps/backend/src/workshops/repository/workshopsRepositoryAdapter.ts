import type { WorkshopsRepository } from "./workshopsRepository.js";
import {
  findWorkshopById,
  insertWorkshop,
  listWorkshopsPage,
  restoreWorkshop,
  softDeleteWorkshops,
  updateWorkshop,
} from "../../db/repositories/workshopEventsRepository.js";
import {
  registerParticipant,
  registerParticipants,
  withdrawParticipant,
} from "../../db/repositories/workshopRegistrationRepository.js";
import {
  aggregateWorkshopsMetrics,
  loadWorkshopDetail,
} from "../../db/repositories/workshopActivityRepository.js";
import {
  saveAttendanceDay,
  saveScores,
} from "../../db/repositories/workshopActivityWriteRepository.js";
import {
  loadCompletionInputs,
  loadReportFacts,
  loadWorkshopPreferences,
  saveWorkshopPreferences,
} from "../../db/repositories/workshopCompletionRepository.js";
import { findWorkspaceTimezone } from "../../db/repositories/workspaceSettingsRepository.js";

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
