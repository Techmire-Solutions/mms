import type { FacultyCatalogRepository } from "../repository/facultyCatalogRepository.js";
import { facultyCatalogRepositoryAdapter } from "../repository/facultyCatalogRepositoryAdapter.js";

/**
 * Composition root for the Faculty catalog (departments, designations, assignments).
 * `repo` is injectable so tests can supply a fake repository without touching Drizzle;
 * production uses the adapter default.
 */
export function createFacultyCatalogUseCases(
  repo: FacultyCatalogRepository = facultyCatalogRepositoryAdapter,
): FacultyCatalogRepository {
  return {
    findFacultyAssignmentById: repo.findFacultyAssignmentById,
    listFacultyAssignments: repo.listFacultyAssignments,
    saveFacultyAssignment: repo.saveFacultyAssignment,
    closeAssignment: repo.closeAssignment,
    softDeleteFacultyAssignment: repo.softDeleteFacultyAssignment,
    findAssignmentSubordinateTree: repo.findAssignmentSubordinateTree,
    findAssignmentManagerChain: repo.findAssignmentManagerChain,
    findFacultyDepartmentById: repo.findFacultyDepartmentById,
    listFacultyDepartments: repo.listFacultyDepartments,
    saveFacultyDepartment: repo.saveFacultyDepartment,
    softDeleteFacultyDepartment: repo.softDeleteFacultyDepartment,
    listFacultyDesignationAssignments: repo.listFacultyDesignationAssignments,
    listFacultyDesignations: repo.listFacultyDesignations,
    saveFacultyDesignation: repo.saveFacultyDesignation,
    softDeleteFacultyDesignation: repo.softDeleteFacultyDesignation,
    restoreFacultyDepartment: repo.restoreFacultyDepartment,
    restoreFacultyDesignation: repo.restoreFacultyDesignation,
  };
}

export const facultyCatalogUseCases = createFacultyCatalogUseCases();

// Named exports let route handlers import the use-case surface directly.
export const {
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
} = facultyCatalogUseCases;
