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
  withdrawParticipant,
} from "../../db/repositories/workshopParticipantsRepository.js";
import {
  aggregateWorkshopsMetrics,
  loadWorkshopDetail,
  saveAttendanceDay,
  saveScores,
} from "../../db/repositories/workshopActivityRepository.js";
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
  withdrawParticipant,
  saveAttendanceDay,
  saveScores,
  aggregateWorkshopsMetrics,
  findWorkspaceTimezone,
};
