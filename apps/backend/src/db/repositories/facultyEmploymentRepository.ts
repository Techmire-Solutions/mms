/**
 * @file facultyEmploymentRepository.ts
 * @description Upsert Employment Records (contact + employee code + lifecycle status).
 */
import { and, eq, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  DEFAULT_FACULTY_STATUS,
  isFacultyStatus,
  type FacultyEmploymentFields,
  type FacultyMember,
} from "@mms/shared";
import { facultyEmployments } from "../schema.js";
import type { AppDb } from "../tenant-context.js";
import { auditEmploymentEntityUpdate } from "./facultyEmploymentEntityAudit.js";

export {
  cascadeSoftDeleteFacultyEmployments,
  cascadeRestoreFacultyEmployments,
} from "./facultyEmploymentCascade.js";

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Flatten nested employment onto dual-write mirrors. */
export function flattenFacultyEmploymentFields(member: FacultyMember): FacultyMember {
  const nested = member.employment as FacultyEmploymentFields | null | undefined;
  if (!nested) return member;
  return {
    ...member,
    employmentId: (typeof nested.id === "string" ? nested.id : undefined) ?? member.employmentId,
    contactId: nested.contactId ?? member.contactId,
    employeeId: nested.employeeId ?? member.employeeId,
    status: (typeof nested.status === "string" ? nested.status : undefined) ?? member.status,
    employmentStartDate: nested.employmentStartDate ?? member.employmentStartDate,
    employmentEndDate: nested.employmentEndDate ?? member.employmentEndDate,
  };
}

export function employmentWriteValues(
  subdomain: string,
  facultyMember: FacultyMember,
  existingId?: string | null,
): typeof facultyEmployments.$inferInsert {
  const flat = flattenFacultyEmploymentFields(facultyMember);
  const employmentStartDate = flat.employmentStartDate ?? flat.joinDate ?? isoToday();
  const status = isFacultyStatus(flat.status) ? flat.status : DEFAULT_FACULTY_STATUS;
  const contactId = String(flat.contactId ?? "").trim();
  return {
    id:
      existingId?.trim() ||
      (typeof flat.employmentId === "string" ? flat.employmentId.trim() : "") ||
      (typeof flat.employment?.id === "string" ? flat.employment.id.trim() : "") ||
      `facemp-${randomUUID()}`,
    workspaceSubdomain: subdomain,
    contactId,
    employeeId: typeof flat.employeeId === "string" ? flat.employeeId.trim() || null : null,
    employmentStartDate,
    employmentEndDate: typeof flat.employmentEndDate === "string" ? flat.employmentEndDate : null,
    status,
    createdBy: typeof flat.createdBy === "string" ? flat.createdBy : null,
    updatedBy: typeof flat.updatedBy === "string" ? flat.updatedBy : null,
    updatedAt: new Date(),
    createdAt: new Date(),
  };
}

/** Upsert employment (owns contact); returns id for faculty.employment_id. */
export async function upsertFacultyEmploymentTx(
  tx: AppDb,
  subdomain: string,
  facultyMember: FacultyMember,
): Promise<string> {
  const flat = flattenFacultyEmploymentFields(facultyMember);
  const contactId = String(flat.contactId ?? "").trim();
  const employmentIdHint = typeof flat.employmentId === "string" ? flat.employmentId.trim() : "";

  let existingId: string | null = null;
  if (employmentIdHint) {
    const byId = await tx
      .select({ id: facultyEmployments.id })
      .from(facultyEmployments)
      .where(
        and(
          eq(facultyEmployments.workspaceSubdomain, subdomain),
          eq(facultyEmployments.id, employmentIdHint),
          isNull(facultyEmployments.deletedAt),
        ),
      )
      .limit(1);
    existingId = byId[0]?.id ?? null;
  }
  if (!existingId && contactId) {
    const byContact = await tx
      .select({ id: facultyEmployments.id })
      .from(facultyEmployments)
      .where(
        and(
          eq(facultyEmployments.workspaceSubdomain, subdomain),
          eq(facultyEmployments.contactId, contactId),
          isNull(facultyEmployments.deletedAt),
        ),
      )
      .limit(1);
    existingId = byContact[0]?.id ?? null;
  }

  const values = employmentWriteValues(subdomain, flat, existingId);
  const {
    id: _id,
    workspaceSubdomain: _ws,
    createdAt: _cAt,
    createdBy: _cBy,
    ...setFields
  } = values;
  await tx
    .insert(facultyEmployments)
    .values(values)
    .onConflictDoUpdate({
      target: [facultyEmployments.workspaceSubdomain, facultyEmployments.id],
      set: setFields,
    });
  await auditEmploymentEntityUpdate(
    tx,
    subdomain,
    "faculty_employments",
    values.id,
    values.updatedBy,
    {
      id: values.id,
      contactId: values.contactId,
      employeeId: values.employeeId,
      status: values.status,
      employmentStartDate: values.employmentStartDate,
      employmentEndDate: values.employmentEndDate,
    },
  );
  return values.id;
}
