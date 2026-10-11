/**
 * @file facultyEmployDesignationRepository.ts
 * @description Upsert Employ Designation tenure rows (HR designation tenure SSOT).
 */
import { and, eq, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  DEFAULT_FACULTY_PROFILE_STATUS,
  isFacultyProfileStatus,
  type FacultyMember,
} from "@mms/shared";
import { facultyEmployDesignations } from "../schema.js";
import type { AppDb } from "../tenant-context.js";
import { auditEmploymentEntityUpdate } from "./facultyEmploymentEntityAudit.js";

export {
  cascadeSoftDeleteFacultyEmployDesignations,
  cascadeRestoreFacultyEmployDesignations,
} from "./facultyEmployDesignationCascade.js";

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function resolveEmployDesignationStatus(member: FacultyMember): "active" | "inactive" {
  const raw = member.employDesignationStatus ?? member.profileStatus;
  return isFacultyProfileStatus(raw) ? raw : DEFAULT_FACULTY_PROFILE_STATUS;
}

/** Upsert employ-designation for an employment; returns tenure id. */
export async function upsertFacultyEmployDesignationTx(
  tx: AppDb,
  subdomain: string,
  employmentId: string,
  facultyMember: FacultyMember,
): Promise<string | null> {
  const designationId =
    typeof facultyMember.designationId === "string" ? facultyMember.designationId.trim() : "";
  if (!designationId || !employmentId) return null;

  const hint =
    typeof facultyMember.employDesignationId === "string"
      ? facultyMember.employDesignationId.trim()
      : "";
  let existingId: string | null = null;
  if (hint) {
    const byId = await tx
      .select({ id: facultyEmployDesignations.id })
      .from(facultyEmployDesignations)
      .where(
        and(
          eq(facultyEmployDesignations.workspaceSubdomain, subdomain),
          eq(facultyEmployDesignations.id, hint),
          isNull(facultyEmployDesignations.deletedAt),
        ),
      )
      .limit(1);
    existingId = byId[0]?.id ?? null;
  }
  if (!existingId) {
    const byEmploymentDesignation = await tx
      .select({ id: facultyEmployDesignations.id })
      .from(facultyEmployDesignations)
      .where(
        and(
          eq(facultyEmployDesignations.workspaceSubdomain, subdomain),
          eq(facultyEmployDesignations.employmentId, employmentId),
          eq(facultyEmployDesignations.designationId, designationId),
          isNull(facultyEmployDesignations.deletedAt),
          eq(facultyEmployDesignations.status, "active"),
          isNull(facultyEmployDesignations.endDate),
        ),
      )
      .limit(1);
    existingId = byEmploymentDesignation[0]?.id ?? null;
  }

  const id = existingId || `faced-${randomUUID()}`;
  const startDate =
    typeof facultyMember.designationStartDate === "string" && facultyMember.designationStartDate
      ? facultyMember.designationStartDate
      : isoToday();
  const endDate =
    typeof facultyMember.designationEndDate === "string" ? facultyMember.designationEndDate : null;
  const status = resolveEmployDesignationStatus(facultyMember);
  const updatedBy = typeof facultyMember.updatedBy === "string" ? facultyMember.updatedBy : null;
  const values = {
    id,
    workspaceSubdomain: subdomain,
    employmentId,
    designationId,
    startDate,
    endDate,
    status,
    createdBy: typeof facultyMember.createdBy === "string" ? facultyMember.createdBy : null,
    updatedBy,
    updatedAt: new Date(),
    createdAt: new Date(),
  } satisfies typeof facultyEmployDesignations.$inferInsert;
  const {
    id: _id,
    workspaceSubdomain: _ws,
    createdAt: _cAt,
    createdBy: _cBy,
    ...setFields
  } = values;
  await tx
    .insert(facultyEmployDesignations)
    .values(values)
    .onConflictDoUpdate({
      target: [facultyEmployDesignations.workspaceSubdomain, facultyEmployDesignations.id],
      set: setFields,
    });
  await auditEmploymentEntityUpdate(tx, subdomain, "faculty_employ_designations", id, updatedBy, {
    id,
    employmentId,
    designationId,
    startDate,
    endDate,
    status,
  });
  return id;
}
