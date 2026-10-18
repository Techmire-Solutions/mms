/**
 * @file facultyEmploymentSsotHydrate.ts
 * @description Overlay employment SSOT fields onto faculty rows (expand dual-read).
 */
import { and, eq, inArray, isNull } from "drizzle-orm";
import { isFacultyStatus, type FacultyMember } from "@mms/shared";
import { facultyEmployments } from "../schema.js";
import type { AppDb } from "../tenant-context.js";

/**
 * When `employment_id` is set, prefer contact / employee code / lifecycle status /
 * employment dates from `faculty_employments` over faculty dual-write mirrors.
 */
export async function attachEmploymentSsotFields(
  tx: AppDb,
  subdomain: string,
  rows: FacultyMember[],
): Promise<FacultyMember[]> {
  const employmentIds = [
    ...new Set(
      rows
        .map((row) => row.employmentId)
        .filter((id): id is string => typeof id === "string" && id.trim().length > 0),
    ),
  ];
  if (employmentIds.length === 0) return rows;

  const empRows = await tx
    .select({
      id: facultyEmployments.id,
      contactId: facultyEmployments.contactId,
      employeeId: facultyEmployments.employeeId,
      status: facultyEmployments.status,
      employmentStartDate: facultyEmployments.employmentStartDate,
      employmentEndDate: facultyEmployments.employmentEndDate,
    })
    .from(facultyEmployments)
    .where(
      and(
        eq(facultyEmployments.workspaceSubdomain, subdomain),
        inArray(facultyEmployments.id, employmentIds),
        isNull(facultyEmployments.deletedAt),
      ),
    );
  const byId = new Map(empRows.map((row) => [row.id, row]));

  return rows.map((member) => {
    const employmentId = member.employmentId?.trim();
    if (!employmentId) return member;
    const emp = byId.get(employmentId);
    if (!emp) return member;
    const status = isFacultyStatus(emp.status) ? emp.status : member.status;
    const employmentStartDate = emp.employmentStartDate ?? member.employmentStartDate ?? null;
    const employmentEndDate = emp.employmentEndDate ?? member.employmentEndDate ?? null;
    return {
      ...member,
      contactId: emp.contactId || member.contactId,
      employeeId: emp.employeeId ?? member.employeeId,
      status,
      employmentStartDate,
      employmentEndDate,
      joinDate: employmentStartDate ?? member.joinDate,
      employment: {
        id: emp.id,
        contactId: emp.contactId,
        employeeId: emp.employeeId,
        status,
        employmentStartDate,
        employmentEndDate,
      },
    };
  });
}

/**
 * Prefer designation mirrors from the last active open employ-designation tenure
 * when the hydrated list is present (dual-read until contract).
 */
export function preferEmployDesignationPrimary(member: FacultyMember): FacultyMember {
  const list = member.employDesignations;
  if (!Array.isArray(list) || list.length === 0) return member;
  const activeOpen = list.filter(
    (row) => row.employDesignationStatus === "active" && !row.designationEndDate?.trim(),
  );
  const primary = activeOpen[activeOpen.length - 1] ?? list[list.length - 1];
  if (!primary?.designationId) return member;
  return {
    ...member,
    designationId: primary.designationId,
    designationStartDate: primary.designationStartDate ?? member.designationStartDate,
    designationEndDate: primary.designationEndDate ?? null,
    employDesignationStatus: primary.employDesignationStatus ?? member.employDesignationStatus,
    employDesignationId: primary.employDesignationId ?? member.employDesignationId,
    profileStatus:
      primary.employDesignationStatus === "inactive" ? "inactive" : member.profileStatus,
  };
}
