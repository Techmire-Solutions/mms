import { useMemo } from "react";
import type { FacultyMember } from "@mms/shared";
import { useFacultyDepartments } from "@/tenant/features/faculty/hooks/useFacultyDepartments";
import { useFacultyDesignations } from "@/tenant/features/faculty/hooks/useFacultyDesignations";
import { useFacultyContractList } from "@/tenant/features/faculty/hooks/useFacultyTsrQueries";

/** Max page size accepted by faculty list API — used for supervisor filter roster. */
const SUPERVISOR_LOOKUP_LIMIT = 100;

/** Catalog + roster options for Work directory filters (department/designation names, supervisor ids). */
export function useFacultyDirectoryFilterCatalog(enabled: boolean) {
  const { data: departments = [] } = useFacultyDepartments();
  const designationsQuery = useFacultyDesignations();
  const rosterQuery = useFacultyContractList(
    {
      page: 1,
      limit: SUPERVISOR_LOOKUP_LIMIT,
      sortField: "name",
      sortDir: "asc",
      status: "active",
    },
    enabled,
  );

  const departmentFilterOptions = useMemo(
    () =>
      departments
        .filter((item) => item.isActive !== false)
        .map((item) => ({ value: item.name, label: item.name }))
        .sort((left, right) => left.label.localeCompare(right.label)),
    [departments],
  );

  const designationFilterOptions = useMemo(
    () =>
      (designationsQuery.data ?? [])
        .filter((item) => item.isActive !== false)
        .map((item) => ({ value: item.name, label: item.name }))
        .sort((left, right) => left.label.localeCompare(right.label)),
    [designationsQuery.data],
  );

  const supervisorFilterOptions = useMemo(() => {
    const roster = (rosterQuery.data?.body?.faculty ?? []) as FacultyMember[];
    return roster
      .map((member: FacultyMember) => ({
        value: String(member.id),
        label: member.name?.trim() || String(member.employeeId || member.id),
      }))
      .sort((left: { label: string }, right: { label: string }) =>
        left.label.localeCompare(right.label),
      );
  }, [rosterQuery.data]);

  return {
    departmentFilterOptions,
    designationFilterOptions,
    supervisorFilterOptions,
  };
}
