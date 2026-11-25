import {
  closeAssignment,
  findFacultyAssignmentById,
  listFacultyAssignments,
  saveFacultyAssignment,
  softDeleteFacultyAssignment,
} from "./db/facultyAssignmentRepository.js";
import {
  findAssignmentManagerChain,
  findAssignmentSubordinateTree,
} from "./db/facultyAssignmentHierarchyRepository.js";
import {
  restoreFacultyDepartment,
  restoreFacultyDesignation,
} from "./db/facultyCatalogTrashRepository.js";
import {
  findFacultyDepartmentById,
  listFacultyDepartments,
  saveFacultyDepartment,
  softDeleteFacultyDepartment,
} from "./db/facultyDepartmentRepository.js";
import {
  listFacultyDesignationAssignments,
  listFacultyDesignations,
  saveFacultyDesignation,
  softDeleteFacultyDesignation,
} from "./db/facultyDesignationRepository.js";
import type { FacultyCatalogRepository } from "./facultyCatalogRepository.js";

/**
 * Drizzle-backed implementation of {@link FacultyCatalogRepository}. The only file in
 * the faculty catalog domain that binds to the concrete storage functions.
 */
export const facultyCatalogRepositoryAdapter: FacultyCatalogRepository = {
  findFacultyAssignmentById,
  listFacultyAssignments,
  saveFacultyAssignment,
  closeAssignment,
  softDeleteFacultyAssignment,
  findAssignmentSubordinateTree,
  findAssignmentManagerChain,
  findFacultyDepartmentById,
  listFacultyDepartments,
  saveFacultyDepartment,
  softDeleteFacultyDepartment,
  listFacultyDesignationAssignments,
  listFacultyDesignations,
  saveFacultyDesignation,
  softDeleteFacultyDesignation,
  restoreFacultyDepartment,
  restoreFacultyDesignation,
};
