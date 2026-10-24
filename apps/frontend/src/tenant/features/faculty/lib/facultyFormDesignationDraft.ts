import {
  isFacultyCatalogRowActive,
  type FacultyDepartmentEntity,
  type FacultyDesignationDefinition,
  type FacultyMember,
} from "@mms/shared";

/**
 * Faculty Management model: employ-designation rows hold catalog `designationId`;
 * department is derived from the designation. Keeps display projections in sync.
 */
export function buildDesignationDraftPatch(
  designation: FacultyDesignationDefinition | undefined,
  departmentEntities: ReadonlyArray<Pick<FacultyDepartmentEntity, "id" | "name">> = [],
): Partial<FacultyMember> {
  if (!designation) {
    return {
      designationId: "",
      designation: "",
      designationAssignableRoles: [],
      parentDesignationId: null,
      departmentId: "",
      department: "",
    };
  }
  const departmentName =
    designation.departmentName ??
    departmentEntities.find((d) => d.id === designation.departmentId)?.name ??
    "";
  return {
    designationId: designation.id,
    designation: designation.name,
    designationAssignableRoles: designation.assignableRoles ?? [],
    parentDesignationId: designation.parentDesignationId ?? null,
    departmentId: designation.departmentId,
    department: departmentName,
  };
}

/** Active designations (plus the currently held one) ordered by department, seniority, name. */
export function selectableDesignationOptions(
  options: ReadonlyArray<FacultyDesignationDefinition>,
  currentDesignationId?: string | null,
): FacultyDesignationDefinition[] {
  return options
    .filter((item) => isFacultyCatalogRowActive(item) || item.id === currentDesignationId)
    .sort(
      (a, b) =>
        (a.departmentName ?? "").localeCompare(b.departmentName ?? "") ||
        (a.hierarchyRank ?? 99) - (b.hierarchyRank ?? 99) ||
        a.name.localeCompare(b.name),
    );
}
