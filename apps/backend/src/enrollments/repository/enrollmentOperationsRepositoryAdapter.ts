import type { EnrollmentOperationsRepository } from "./enrollmentOperationsRepository.js";
import {
  applyEnrollmentTransfer,
  applyEnrollmentReadmission,
  applyEnrollmentWithdrawal,
  listEnrollmentPlacements,
  countLiveSeatsByClassTx,
  listOperableEnrollments,
  lockRolloverCarryTx,
  recordEnrollmentSuspension,
} from "../../db/repositories/enrollmentOperationsRepository.js";
import { findEnrollmentById } from "../../db/repositories/enrollmentRepositoryHydrate.js";
import { findSessionById } from "../../db/repositories/sessionRepositoryQueries.js";
import { getEnrollmentModulePreferencesByWorkspace } from "../../db/repositories/enrollmentModulePreferencesRepository.js";
import { getSessionModulePreferencesByWorkspace } from "../../db/repositories/sessionModulePreferencesRepository.js";
import { findWorkspaceTimezone } from "../../db/repositories/workspaceRepository.js";
import { findStudentsByIds } from "../../db/repositories/studentRepositoryHydrate.js";

/** Drizzle-backed adapter for {@link EnrollmentOperationsRepository}. */
export const enrollmentOperationsRepository: EnrollmentOperationsRepository = {
  findEnrollmentById,
  findSessionById,
  getEnrollmentModulePreferencesByWorkspace,
  getSessionModulePreferencesByWorkspace,
  findWorkspaceTimezone,
  findStudentsByIds,
  listEnrollmentPlacements,
  applyEnrollmentTransfer,
  applyEnrollmentWithdrawal,
  listOperableEnrollments,
  countLiveSeatsByClassTx,
  lockRolloverCarryTx,
  applyEnrollmentReadmission,
  recordEnrollmentSuspension,
};
