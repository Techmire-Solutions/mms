/**
 * @file facultyEmployDesignationSync.ts
 * @description Persist multiple concurrent employ-designation rows from faculty form writes.
 *
 * Ownership: HR designation tenure (form cards, RBAC sources). Org position /
 * reports-to remains on faculty_assignments via syncPrimaryAppointment.
 */
import { and, eq, inArray, isNull, notInArray } from "drizzle-orm";
import {
  isFacultyProfileStatus,
  resolveFacultyProfileStatus,
  type FacultyEmployDesignationWriteRow,
  type FacultyMember,
} from "@mms/shared";
import { facultyEmployDesignations } from "../schema.js";
import type { AppDb } from "../tenant-context.js";
import { auditEmploymentEntitySoftDeletes } from "./facultyEmploymentEntityAudit.js";
import { upsertFacultyEmployDesignationTx } from "./facultyEmployDesignationRepository.js";

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function isWriteRow(row: unknown): row is FacultyEmployDesignationWriteRow {
  return Boolean(
    row &&
    typeof row === "object" &&
    typeof (row as FacultyEmployDesignationWriteRow).designationId === "string",
  );
}

function assertNoDuplicateActiveOpenDesignations(rows: FacultyEmployDesignationWriteRow[]): void {
  const seen = new Set<string>();
  for (const row of rows) {
    const statusRaw = row.employDesignationStatus;
    const status = isFacultyProfileStatus(statusRaw)
      ? statusRaw
      : resolveFacultyProfileStatus(statusRaw);
    if (status !== "active" || row.designationEndDate?.trim()) continue;
    const designationId = row.designationId.trim();
    if (!designationId) continue;
    if (seen.has(designationId)) {
      throw new Error(
        `Duplicate active open employ designation for designation "${designationId}"`,
      );
    }
    seen.add(designationId);
  }
}

/** Upsert each row; soft-delete prior rows omitted from the payload; return primary id. */
export async function syncFacultyEmployDesignationsTx(
  tx: AppDb,
  subdomain: string,
  employmentId: string,
  facultyMember: FacultyMember,
): Promise<string | null> {
  const raw = facultyMember.employDesignations;
  if (!Array.isArray(raw) || raw.length === 0) {
    return upsertFacultyEmployDesignationTx(tx, subdomain, employmentId, facultyMember);
  }
  const rows = raw.filter(isWriteRow).filter((row) => row.designationId.trim().length > 0);
  if (rows.length === 0) return null;
  assertNoDuplicateActiveOpenDesignations(rows);

  const keptIds: string[] = [];
  let primaryId: string | null = null;
  const now = new Date();
  const deletedBy =
    typeof facultyMember.updatedBy === "string"
      ? facultyMember.updatedBy
      : typeof facultyMember.createdBy === "string"
        ? facultyMember.createdBy
        : "system";
  const deletionReason = "Removed from faculty designation form";

  for (const row of rows) {
    const statusRaw = row.employDesignationStatus;
    const status = isFacultyProfileStatus(statusRaw)
      ? statusRaw
      : resolveFacultyProfileStatus(statusRaw);
    const slice: FacultyMember = {
      ...facultyMember,
      designationId: row.designationId.trim(),
      designationStartDate: row.designationStartDate ?? isoToday(),
      designationEndDate: row.designationEndDate ?? null,
      employDesignationStatus: status,
      profileStatus: status,
      employDesignationId: row.employDesignationId ?? null,
    };
    const id = await upsertFacultyEmployDesignationTx(tx, subdomain, employmentId, slice);
    if (!id) continue;
    keptIds.push(id);
    if (status === "active" && !row.designationEndDate) {
      // Last active open-ended card wins as dual-write primary.
      primaryId = id;
    }
  }

  if (keptIds.length > 0) {
    const omitted = await tx
      .update(facultyEmployDesignations)
      .set({
        deletedAt: now,
        deletedBy,
        deletionReason,
        deletedWithCascade: false,
        updatedAt: now,
      })
      .where(
        and(
          eq(facultyEmployDesignations.workspaceSubdomain, subdomain),
          eq(facultyEmployDesignations.employmentId, employmentId),
          isNull(facultyEmployDesignations.deletedAt),
          notInArray(facultyEmployDesignations.id, keptIds),
        ),
      )
      .returning({ id: facultyEmployDesignations.id });
    if (omitted.length > 0) {
      await auditEmploymentEntitySoftDeletes(
        tx,
        subdomain,
        "faculty_employ_designations",
        omitted.map((row) => row.id),
        deletedBy,
        deletionReason,
        now,
      );
    }
  }

  return primaryId ?? keptIds[0] ?? null;
}

/** Hydrate `employDesignations` for faculty list/detail reads. */
export async function attachEmployDesignationList(
  tx: AppDb,
  subdomain: string,
  rows: FacultyMember[],
): Promise<FacultyMember[]> {
  const employmentIds = [
    ...new Set(
      rows
        .map((row) => row.employmentId)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];
  if (employmentIds.length === 0) return rows;
  const desigRows = await tx
    .select({
      id: facultyEmployDesignations.id,
      employmentId: facultyEmployDesignations.employmentId,
      designationId: facultyEmployDesignations.designationId,
      startDate: facultyEmployDesignations.startDate,
      endDate: facultyEmployDesignations.endDate,
      status: facultyEmployDesignations.status,
    })
    .from(facultyEmployDesignations)
    .where(
      and(
        eq(facultyEmployDesignations.workspaceSubdomain, subdomain),
        inArray(facultyEmployDesignations.employmentId, employmentIds),
        isNull(facultyEmployDesignations.deletedAt),
      ),
    );
  const byEmployment = new Map<string, FacultyEmployDesignationWriteRow[]>();
  for (const row of desigRows) {
    const list = byEmployment.get(row.employmentId) ?? [];
    list.push({
      employDesignationId: row.id,
      designationId: row.designationId,
      designationStartDate: row.startDate ?? null,
      designationEndDate: row.endDate ?? null,
      employDesignationStatus: isFacultyProfileStatus(row.status)
        ? row.status
        : resolveFacultyProfileStatus(row.status),
    });
    byEmployment.set(row.employmentId, list);
  }
  return rows.map((member) => {
    const employmentId = member.employmentId;
    if (!employmentId) return member;
    const employDesignations = byEmployment.get(employmentId);
    if (!employDesignations?.length) return member;
    return { ...member, employDesignations };
  });
}
