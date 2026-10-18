import type { SessionsAcademicRepository } from "./sessionsAcademicRepository.js";
import {
  listAcademicCatalog,
  restoreAcademicCatalogItem,
  saveAcademicCatalogItem,
  softDeleteAcademicCatalogItem,
} from "../../db/repositories/academicCatalogRepository.js";
import {
  listRegistrationLinks,
  saveRegistrationLink,
  softDeleteRegistrationLink,
} from "../../db/repositories/registrationLinkRepository.js";
import { findSessionById } from "../../db/repositories/sessionRepositoryQueries.js";
import { findUntaughtClassDates } from "../../db/repositories/teacherSectionScopeRepository.js";
import {
  assignSectionStaff,
  endSectionStaff,
  listSectionStaff,
} from "../../db/repositories/sectionStaffRepository.js";
import {
  addSectionStudentRole,
  endSectionStudentRole,
  listSectionStudentRoles,
} from "../../db/repositories/sectionStudentRolesRepository.js";

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
  findUntaughtClassDates,
  listSectionStaff,
  assignSectionStaff,
  endSectionStaff,
  listSectionStudentRoles,
  addSectionStudentRole,
  endSectionStudentRole,
};
