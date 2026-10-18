import type { EnrollmentOperationsRepository } from "./enrollmentOperationsRepository.js";
import {
  applyEnrollmentTransfer,
  applyEnrollmentWithdrawal,
  listEnrollmentPlacements,
} from "../../db/repositories/enrollmentOperationsRepository.js";
import { findEnrollmentById } from "../../db/repositories/enrollmentRepositoryHydrate.js";
import { findSessionById } from "../../db/repositories/sessionRepositoryQueries.js";
import { getEnrollmentModulePreferencesByWorkspace } from "../../db/repositories/enrollmentModulePreferencesRepository.js";
import { findWorkspaceTimezone } from "../../db/repositories/workspaceRepository.js";

/** Drizzle-backed adapter for {@link EnrollmentOperationsRepository}. */
export const enrollmentOperationsRepository: EnrollmentOperationsRepository = {
  findEnrollmentById,
  findSessionById,
  getEnrollmentModulePreferencesByWorkspace,
  findWorkspaceTimezone,
  listEnrollmentPlacements,
  applyEnrollmentTransfer,
  applyEnrollmentWithdrawal,
};
