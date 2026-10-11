import type { FacultyRecord } from "@mms/shared";
import {
  closeAssignment,
  findPrimaryFacultyAssignment,
  saveFacultyAssignment,
} from "../../db/repositories/facultyAssignmentRepository.js";
import { ValidationError } from "../../lib/httpErrors.js";
import { prepareFacultyRecord } from "./facultyNormalizeUseCases.js";
import {
  validateFacultyContactLink,
  validateFacultyDesignationLink,
} from "./facultyWriteGuards.js";

/** Injectable guard seam so unit tests run against in-memory repositories. */
export interface FacultyWriteGuards {
  validateContactLink: typeof validateFacultyContactLink;
  validateDesignationLink: typeof validateFacultyDesignationLink;
  syncPrimaryAppointment: typeof syncPrimaryAppointment;
}

const isoToday = (): string => new Date().toISOString().slice(0, 10);

function shiftIsoDate(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Compatibility bridge: mirrors primary designation (from payload / employ-designation)
 * into the primary `faculty_assignments` row so Organization positions, Tasks
 * delegation and Sessions keep working. Carries the existing position across
 * designation changes. HR tenure SSOT remains faculty_employ_designations.
 */
export async function syncPrimaryAppointment(
  tenant: string,
  record: FacultyRecord,
  departmentId: string | null,
): Promise<void> {
  const designationId = record.designationId?.trim();
  if (!designationId || !departmentId) return;
  const facultyId = String(record.id);
  const today = isoToday();
  const current = await findPrimaryFacultyAssignment(tenant, facultyId, today);
  if (current?.designationId === designationId && current.departmentId === departmentId) return;

  if (current && current.startDate >= today) {
    await saveFacultyAssignment(tenant, {
      ...current,
      workspaceSubdomain: tenant,
      departmentId,
      designationId,
      status: "active",
      updatedBy: record.updatedBy ?? null,
    });
    return;
  }
  if (current) {
    await closeAssignment(
      tenant,
      current.id,
      shiftIsoDate(today, -1),
      record.updatedBy ?? undefined,
    );
  }
  const designationStart =
    typeof record.designationStartDate === "string" ? record.designationStartDate.trim() : "";
  const startDate = current ? today : designationStart.length > 0 ? designationStart : today;
  await saveFacultyAssignment(tenant, {
    id: `fa-${facultyId}-${Date.now().toString(36)}`,
    workspaceSubdomain: tenant,
    facultyId,
    departmentId,
    designationId,
    startDate: startDate > today ? today : startDate,
    endDate: typeof record.designationEndDate === "string" ? record.designationEndDate : null,
    isPrimary: true,
    status: "active",
    notes: null,
    updatedBy: record.updatedBy ?? null,
  });
}

export const defaultFacultyWriteGuards: FacultyWriteGuards = {
  validateContactLink: validateFacultyContactLink,
  validateDesignationLink: validateFacultyDesignationLink,
  syncPrimaryAppointment,
};

/**
 * Runs the Faculty Management link guards before persisting. Returns the record
 * with the registered `userId` attached (when a user account exists for the
 * contact) and the designation's department for the appointment bridge.
 */
export async function applyFacultyWriteGuards(
  tenant: string,
  record: FacultyRecord,
  guards: FacultyWriteGuards,
  options: { excludeFacultyId?: string; designationChanged: boolean; contactChanged: boolean },
): Promise<{ record: FacultyRecord; departmentId: string | null }> {
  let next = record;
  const contactId = record.contactId != null ? String(record.contactId).trim() : "";
  if (contactId && options.contactChanged) {
    const { userId } = await guards.validateContactLink(
      tenant,
      contactId,
      options.excludeFacultyId,
    );
    if (userId && !next.userId) next = { ...next, userId };
  }
  const designationId = record.designationId?.trim() ?? "";
  if (!designationId) throw new ValidationError("Selected designation is required");
  if (!options.designationChanged) return { record: next, departmentId: null };
  const { departmentId } = await guards.validateDesignationLink(tenant, designationId);
  return { record: next, departmentId };
}

/**
 * Handles the implicit restore path when an incoming `contactId` matches a
 * soft-deleted faculty row. Returns the merged + persisted record.
 */
export async function handleImplicitRestore(
  tenant: string,
  archived: FacultyRecord,
  normalized: FacultyRecord,
  save: (tenant: string, record: FacultyRecord) => Promise<void>,
): Promise<FacultyRecord> {
  const merged = prepareFacultyRecord({
    ...archived,
    ...normalized,
    id: archived.id,
  });
  await save(tenant, merged);
  return merged;
}
