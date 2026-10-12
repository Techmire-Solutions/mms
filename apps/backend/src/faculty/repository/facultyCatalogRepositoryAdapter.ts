import {
  closeAssignment,
  findFacultyAssignmentById,
  listFacultyAssignments,
  saveFacultyAssignment,
  softDeleteFacultyAssignment,
} from "../../db/repositories/facultyAssignmentRepository.js";
import {
  findAssignmentManagerChain,
  findAssignmentSubordinateTree,
} from "../../db/repositories/facultyAssignmentHierarchyRepository.js";
import {
  restoreFacultyDepartment,
  restoreFacultyDesignation,
} from "../../db/repositories/facultyCatalogTrashRepository.js";
import {
  findFacultyDepartmentById,
  listFacultyDepartments,
  saveFacultyDepartment,
  softDeleteFacultyDepartment,
} from "../../db/repositories/facultyDepartmentRepository.js";
import {
  listFacultyDesignationAssignments,
  listFacultyDesignations,
  saveFacultyDesignation,
  softDeleteFacultyDesignation,
} from "../../db/repositories/facultyDesignationRepository.js";
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
