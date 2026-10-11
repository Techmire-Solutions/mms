import {
  DEFAULT_FACULTY_PROFILE_STATUS,
  resolveFacultyProfileStatus,
  todayISO,
  type FacultyEmployDesignationFormRow,
  type FacultyEmployDesignationWriteRow,
  type FacultyMember,
} from "@mms/shared";

export function newEmployDesignationFormRow(
  partial?: Partial<FacultyEmployDesignationFormRow>,
): FacultyEmployDesignationFormRow {
  return {
    clientId: partial?.clientId ?? `fed-${crypto.randomUUID()}`,
    employDesignationId: partial?.employDesignationId ?? null,
    designationId: partial?.designationId ?? "",
    designationStartDate: partial?.designationStartDate ?? todayISO(),
    designationEndDate: partial?.designationEndDate ?? null,
    employDesignationStatus: resolveFacultyProfileStatus(
      partial?.employDesignationStatus ?? DEFAULT_FACULTY_PROFILE_STATUS,
    ),
  };
}

/** Build form rows from persisted faculty mirrors (single or `employDesignations`). */
export function employDesignationRowsFromFaculty(
  faculty?: Partial<FacultyMember> | null,
): FacultyEmployDesignationFormRow[] {
  const nested = faculty?.employDesignations;
  if (Array.isArray(nested) && nested.length > 0) {
    return nested.map((row) =>
      newEmployDesignationFormRow({
        clientId: `fed-${row.employDesignationId ?? row.designationId ?? crypto.randomUUID()}`,
        employDesignationId: row.employDesignationId ?? null,
        designationId: row.designationId ?? "",
        designationStartDate: row.designationStartDate ?? todayISO(),
        designationEndDate: row.designationEndDate ?? null,
        employDesignationStatus: row.employDesignationStatus,
      }),
    );
  }
  if (faculty?.designationId) {
    return [
      newEmployDesignationFormRow({
        clientId: `fed-${faculty.employDesignationId ?? faculty.designationId}`,
        employDesignationId: faculty.employDesignationId ?? null,
        designationId: String(faculty.designationId),
        designationStartDate: faculty.designationStartDate ?? todayISO(),
        designationEndDate: faculty.designationEndDate ?? null,
        employDesignationStatus: resolveFacultyProfileStatus(
          faculty.employDesignationStatus ?? faculty.profileStatus,
        ),
      }),
    ];
  }
  return [];
}

/** Primary row drives dual-write mirrors on `FacultyMember` for list/save compat. */
export function pickPrimaryEmployDesignationRow(
  rows: readonly FacultyEmployDesignationFormRow[],
): FacultyEmployDesignationFormRow | undefined {
  const openActive = rows.find(
    (row) =>
      row.designationId &&
      resolveFacultyProfileStatus(row.employDesignationStatus) === "active" &&
      !row.designationEndDate,
  );
  if (openActive) return openActive;
  const withDesignation = rows.filter((row) => row.designationId);
  return withDesignation[withDesignation.length - 1] ?? rows[0];
}

export function employDesignationRowsToWritePayload(
  rows: readonly FacultyEmployDesignationFormRow[],
): FacultyEmployDesignationWriteRow[] {
  return rows
    .filter((row) => row.designationId.trim().length > 0)
    .map(({ clientId: _c, ...row }) => ({
      employDesignationId: row.employDesignationId ?? null,
      designationId: row.designationId.trim(),
      designationStartDate: row.designationStartDate ?? null,
      designationEndDate: row.designationEndDate ?? null,
      employDesignationStatus: resolveFacultyProfileStatus(row.employDesignationStatus),
    }));
}

export function flatDraftPatchFromEmployDesignationRows(
  rows: readonly FacultyEmployDesignationFormRow[],
): Partial<FacultyMember> {
  const primary = pickPrimaryEmployDesignationRow(rows);
  if (!primary?.designationId) {
    return {
      employDesignations: employDesignationRowsToWritePayload(rows),
      designationId: "",
      designationStartDate: null,
      designationEndDate: null,
    };
  }
  const status = resolveFacultyProfileStatus(primary.employDesignationStatus);
  return {
    employDesignations: employDesignationRowsToWritePayload(rows),
    designationId: primary.designationId,
    designationStartDate: primary.designationStartDate ?? todayISO(),
    designationEndDate: primary.designationEndDate ?? null,
    employDesignationStatus: status,
    profileStatus: status,
    employDesignationId: primary.employDesignationId ?? null,
  };
}
