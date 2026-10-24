/**
 * @file facultyRepositoryColumns.ts
 * @description Persist faculty profile + hydrate from employment SSOT (no dual-write mirrors).
 */
import { and, eq, isNull } from "drizzle-orm";
import { faculty, tenantUsers } from "../schema.js";
import type { AppDb } from "../tenant-context.js";
import type { FacultyMember } from "@mms/shared";
import {
  DEFAULT_FACULTY_PROFILE_STATUS,
  DEFAULT_FACULTY_STATUS,
  isFacultyProfileStatus,
  parseFacultyPerformanceRating,
} from "@mms/shared";
import { mapAuditTimestamps, mapAuditToInsert } from "./repositoryMappers.js";
import { attachPrimaryAppointmentFields } from "./facultyPrimaryAppointmentHydrate.js";
import {
  flattenFacultyEmploymentFields,
  upsertFacultyEmploymentTx,
} from "./facultyEmploymentRepository.js";
import {
  attachEmployDesignationList,
  syncFacultyEmployDesignationsTx,
} from "./facultyEmployDesignationSync.js";
import {
  attachEmploymentSsotFields,
  preferEmployDesignationPrimary,
} from "./facultyEmploymentSsotHydrate.js";
import { FACULTY_PROJECTION_COLUMNS, KNOWN_FACULTY_KEYS } from "./facultyRepositoryColumnDefs.js";

export type FacultyInsert = typeof faculty.$inferInsert;
export { FACULTY_PROJECTION_COLUMNS };

export function facultyWriteValues(
  subdomain: string,
  facultyMember: FacultyMember,
  employmentId: string,
): FacultyInsert {
  const flat = flattenFacultyEmploymentFields(facultyMember);
  const audit = mapAuditToInsert(flat);
  const customData = Object.fromEntries(
    Object.entries(flat as Record<string, unknown>).filter(([key]) => !KNOWN_FACULTY_KEYS.has(key)),
  );
  const rating = parseFacultyPerformanceRating(flat.performanceRating);
  const employDesigStatusRaw = flat.employDesignationStatus ?? flat.profileStatus;
  const profileStatus = isFacultyProfileStatus(employDesigStatusRaw)
    ? employDesigStatusRaw
    : DEFAULT_FACULTY_PROFILE_STATUS;
  return {
    id: String(flat.id),
    workspaceSubdomain: subdomain,
    employmentId,
    userId: flat.userId ? String(flat.userId) : null,
    profileStatus,
    specialization: typeof flat.specialization === "string" ? flat.specialization : null,
    qualification: typeof flat.qualification === "string" ? flat.qualification : null,
    performanceRating: rating === null ? null : rating.toFixed(1),
    notes: typeof flat.notes === "string" ? flat.notes : null,
    customData,
    ...audit,
    createdAt: audit.createdAt ?? new Date(),
  } satisfies FacultyInsert;
}

/** Map a faculty projection row; employment/designation fields filled by hydrate overlays. */
export function facultyRowToRecord(
  row: typeof faculty.$inferSelect & {
    contactId?: string | null;
    employeeId?: string | null;
    status?: string | null;
    designationId?: string | null;
    designationStartDate?: string | null;
    designationEndDate?: string | null;
    employmentStartDate?: string | null;
    employmentEndDate?: string | null;
    joinDate?: string | null;
  },
): FacultyMember {
  const employmentStartDate = row.employmentStartDate ?? null;
  const status = row.status ?? DEFAULT_FACULTY_STATUS;
  const profileStatus = isFacultyProfileStatus(row.profileStatus)
    ? row.profileStatus
    : DEFAULT_FACULTY_PROFILE_STATUS;
  return {
    ...(row.customData ?? {}),
    id: row.id,
    contactId: row.contactId ?? "",
    employmentId: row.employmentId ?? null,
    userId: row.userId ?? null,
    status,
    profileStatus,
    employeeId: row.employeeId ?? undefined,
    designationId: row.designationId ?? null,
    designationStartDate: row.designationStartDate ?? null,
    designationEndDate: row.designationEndDate ?? null,
    employDesignationStatus: profileStatus,
    specialization: row.specialization ?? undefined,
    qualification: row.qualification ?? undefined,
    employmentStartDate,
    employmentEndDate: row.employmentEndDate ?? null,
    employment: {
      id: row.employmentId ?? undefined,
      contactId: row.contactId ?? "",
      employeeId: row.employeeId ?? null,
      status,
      employmentStartDate,
      employmentEndDate: row.employmentEndDate ?? null,
    },
    performanceRating: parseFacultyPerformanceRating(row.performanceRating),
    joinDate: employmentStartDate ?? row.joinDate ?? undefined,
    notes: row.notes ?? undefined,
    ...mapAuditTimestamps(row),
  } satisfies FacultyMember;
}

export async function hydrateFacultyList(
  tx: AppDb,
  subdomain: string,
  rows: (typeof faculty.$inferSelect)[],
): Promise<FacultyMember[]> {
  const members = rows.map(facultyRowToRecord);
  const withAppointments = await attachPrimaryAppointmentFields(tx, subdomain, members);
  const withTenures = await attachEmployDesignationList(tx, subdomain, withAppointments);
  const withEmployment = await attachEmploymentSsotFields(tx, subdomain, withTenures);
  return withEmployment.map(preferEmployDesignationPrimary);
}

export async function attachPrimaryAppointmentToFacultyList(
  tx: AppDb,
  subdomain: string,
  rows: FacultyMember[],
): Promise<FacultyMember[]> {
  return attachPrimaryAppointmentFields(tx, subdomain, rows);
}

export function facultyUpdateSetValues(
  subdomain: string,
  facultyMember: FacultyMember,
  employmentId: string,
) {
  const {
    id: _i,
    workspaceSubdomain: _w,
    createdAt: _c,
    createdBy: _b,
    ...set
  } = facultyWriteValues(subdomain, facultyMember, employmentId);
  return set;
}

/** Persist employment + employ-designation SSOT, then faculty profile only. */
export async function persistFacultyTx(
  tx: AppDb,
  subdomain: string,
  facultyMember: FacultyMember,
  options?: { createOnly?: boolean },
): Promise<void> {
  const flat = flattenFacultyEmploymentFields(facultyMember);
  const employmentId = await upsertFacultyEmploymentTx(tx, subdomain, flat);
  const employDesignationId = await syncFacultyEmployDesignationsTx(
    tx,
    subdomain,
    employmentId,
    flat,
  );
  let userId = flat.userId ? String(flat.userId) : null;
  const contactId = String(flat.contactId ?? "").trim();
  if (!userId && contactId) {
    const linked = await tx
      .select({ id: tenantUsers.id })
      .from(tenantUsers)
      .where(
        and(
          eq(tenantUsers.workspaceSubdomain, subdomain),
          eq(tenantUsers.contactId, contactId),
          isNull(tenantUsers.deletedAt),
        ),
      )
      .limit(1);
    userId = linked[0]?.id ?? null;
  }
  const withEmployment = {
    ...flat,
    employmentId,
    userId,
    employDesignationId: employDesignationId ?? flat.employDesignationId ?? null,
  };
  const values = facultyWriteValues(subdomain, withEmployment, employmentId);
  if (options?.createOnly) {
    await tx.insert(faculty).values(values);
    return;
  }
  await tx
    .insert(faculty)
    .values(values)
    .onConflictDoUpdate({
      target: [faculty.workspaceSubdomain, faculty.id],
      set: facultyUpdateSetValues(subdomain, withEmployment, employmentId),
    });
}
