import type { EnrollmentOperationsRepository } from "./enrollmentOperationsRepository.js";
import {
  applyEnrollmentTransfer,
  applyEnrollmentReadmission,
  applyEnrollmentWithdrawal,
  bulkApplyEnrollmentWithdrawal,
  listEnrollmentPlacements,
  countLiveSeatsByClassTx,
  listOperableEnrollments,
  lockRolloverCarryTx,
  recordEnrollmentSuspension,
} from "../repository/db/enrollmentOperationsRepository.js";
import { findEnrollmentById } from "../repository/db/enrollmentRepositoryHydrate.js";
import { findSessionById } from "../deps.js";
import { getEnrollmentModulePreferencesByWorkspace } from "../repository/db/enrollmentModulePreferencesRepository.js";
import { getSessionModulePreferencesByWorkspace } from "../deps.js";
import { findWorkspaceTimezone } from "../deps.js";
import { findStudentsByIds } from "../deps.js";

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
  bulkApplyEnrollmentWithdrawal,
  listOperableEnrollments,
  countLiveSeatsByClassTx,
  lockRolloverCarryTx,
  applyEnrollmentReadmission,
  recordEnrollmentSuspension,
};
