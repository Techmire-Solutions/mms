/**
 * @file facultyCatalogRepository.ts
 * @description Storage contract for the Faculty catalog (departments, designations,
 * assignments and their hierarchy).
 *
 * Use-cases depend on this interface — never on the concrete Drizzle functions in
 * `db/repositories/*`. The Drizzle-backed adapter is the only implementation.
 */
type AssignmentModule = typeof import("../../db/repositories/facultyAssignmentRepository.js");
type AssignmentHierarchyModule =
  typeof import("../../db/repositories/facultyAssignmentHierarchyRepository.js");
type DepartmentModule = typeof import("../../db/repositories/facultyDepartmentRepository.js");
type DesignationModule = typeof import("../../db/repositories/facultyDesignationRepository.js");
type CatalogTrashModule = typeof import("../../db/repositories/facultyCatalogTrashRepository.js");

export interface FacultyCatalogRepository {
  findFacultyAssignmentById: AssignmentModule["findFacultyAssignmentById"];
  listFacultyAssignments: AssignmentModule["listFacultyAssignments"];
  saveFacultyAssignment: AssignmentModule["saveFacultyAssignment"];
  closeAssignment: AssignmentModule["closeAssignment"];
  softDeleteFacultyAssignment: AssignmentModule["softDeleteFacultyAssignment"];

  findAssignmentSubordinateTree: AssignmentHierarchyModule["findAssignmentSubordinateTree"];
  findAssignmentManagerChain: AssignmentHierarchyModule["findAssignmentManagerChain"];

  findFacultyDepartmentById: DepartmentModule["findFacultyDepartmentById"];
  listFacultyDepartments: DepartmentModule["listFacultyDepartments"];
  saveFacultyDepartment: DepartmentModule["saveFacultyDepartment"];
  softDeleteFacultyDepartment: DepartmentModule["softDeleteFacultyDepartment"];

  listFacultyDesignationAssignments: DesignationModule["listFacultyDesignationAssignments"];
  listFacultyDesignations: DesignationModule["listFacultyDesignations"];
  saveFacultyDesignation: DesignationModule["saveFacultyDesignation"];
  softDeleteFacultyDesignation: DesignationModule["softDeleteFacultyDesignation"];

  restoreFacultyDepartment: CatalogTrashModule["restoreFacultyDepartment"];
  restoreFacultyDesignation: CatalogTrashModule["restoreFacultyDesignation"];
}
