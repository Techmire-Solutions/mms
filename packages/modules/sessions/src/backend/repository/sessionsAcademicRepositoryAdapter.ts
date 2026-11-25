import type { SessionsAcademicRepository } from "./sessionsAcademicRepository.js";
import {
  listAcademicCatalog,
  restoreAcademicCatalogItem,
  saveAcademicCatalogItem,
  softDeleteAcademicCatalogItem,
} from "../repository/db/academicCatalogRepository.js";
import {
  listRegistrationLinks,
  saveRegistrationLink,
  softDeleteRegistrationLink,
} from "../repository/db/registrationLinkRepository.js";
import { findSessionById } from "../repository/db/sessionRepositoryQueries.js";
import { findWorkspaceTimezone } from "../deps.js";
import {
  findUntaughtClassDates,
  findUnstaffedSectionDates,
  isFacultyLinked,
  listTaughtStudentIds,
} from "../repository/db/teacherSectionScopeRepository.js";
import {
  applySectionClose,
  applySectionMerge,
  applySectionSplit,
  loadSectionRoster,
} from "../repository/db/sectionOperationsRepository.js";
import { listSessionActivity } from "../repository/db/sessionActivityRepository.js";
import {
  assignSectionStaff,
  endSectionStaff,
  listSectionStaff,
} from "../repository/db/sectionStaffRepository.js";
import {
  addSectionStudentRole,
  endSectionStudentRole,
  listSectionStudentRoles,
} from "../repository/db/sectionStudentRolesRepository.js";

/** Drizzle-backed adapter for {@link SessionsAcademicRepository}. */
export const sessionsAcademicRepository: SessionsAcademicRepository = {
  listAcademicCatalog,
  saveAcademicCatalogItem,
  softDeleteAcademicCatalogItem,
  restoreAcademicCatalogItem,
  listRegistrationLinks,
  saveRegistrationLink,
  softDeleteRegistrationLink,
  findSessionById,
  findWorkspaceTimezone,
  isFacultyLinked,
  findUntaughtClassDates,
  findUnstaffedSectionDates,
  listTaughtStudentIds,
  loadSectionRoster,
  listSessionActivity,
  applySectionMerge,
  applySectionSplit,
  applySectionClose,
  listSectionStaff,
  assignSectionStaff,
  endSectionStaff,
  listSectionStudentRoles,
  addSectionStudentRole,
  endSectionStudentRole,
};
