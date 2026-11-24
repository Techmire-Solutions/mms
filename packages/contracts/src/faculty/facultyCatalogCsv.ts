import { buildCsvContent } from "../core/csvUtils.js";
import type { FacultyDepartmentEntity } from "./facultyDepartmentTypes.js";
import type { FacultyDesignationDefinition } from "./facultyDesignationTypes.js";

export const FACULTY_DEPARTMENT_CSV_COLUMNS = [
  { id: "name", label: "name" },
  { id: "description", label: "description" },
  { id: "status", label: "status" },
] as const;

export const FACULTY_DESIGNATION_CSV_COLUMNS = [
  { id: "department", label: "department" },
  { id: "name", label: "name" },
  { id: "parentDesignation", label: "parentDesignation" },
  { id: "status", label: "status" },
] as const;

export function buildFacultyDepartmentExportRows(
  departments: FacultyDepartmentEntity[],
): string[][] {
  const header = FACULTY_DEPARTMENT_CSV_COLUMNS.map((column) => column.label);
  const rows = departments.map((department) => [
    department.name,
    department.description ?? "",
    department.status,
  ]);
  return [header, ...rows];
}

export function buildFacultyDesignationExportRows(
  designations: FacultyDesignationDefinition[],
): string[][] {
  const nameById = new Map(designations.map((designation) => [designation.id, designation.name]));
  const header = FACULTY_DESIGNATION_CSV_COLUMNS.map((column) => column.label);
  const rows = designations.map((designation) => [
    designation.departmentName ?? "",
    designation.name,
    designation.parentDesignationId ? (nameById.get(designation.parentDesignationId) ?? "") : "",
    designation.status,
  ]);
  return [header, ...rows];
}

export function facultyDepartmentsToCsv(departments: FacultyDepartmentEntity[]): string {
  return buildCsvContent(buildFacultyDepartmentExportRows(departments));
}

export function facultyDesignationsToCsv(designations: FacultyDesignationDefinition[]): string {
  return buildCsvContent(buildFacultyDesignationExportRows(designations));
}
