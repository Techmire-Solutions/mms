/**
 * @file facultySoftDeleteCascade.ts
 * @description Cascade soft-delete of assignments, employ-designations, employments + parent outbox.
 */
import type { Faculty } from "@mms/shared";
import { emitOutboxEvent } from "../../services/outboxEventService.js";
import { cascadeSoftDeleteFacultyAssignments } from "../../db/repositories/facultyAssignmentCascade.js";
import { cascadeSoftDeleteFacultyEmployments } from "../../db/repositories/facultyEmploymentRepository.js";
import { cascadeSoftDeleteFacultyEmployDesignations } from "../../db/repositories/facultyEmployDesignationRepository.js";
import { revokeFacultySessions } from "./facultySoftDeleteSessions.js";

/** Cascade children then emit faculty soft-delete outbox + revoke sessions. */
export async function cascadeFacultySoftDeleteSideEffects(
  tenant: string,
  toSave: Faculty[],
  deletedBy: string,
  trimmedReason: string | undefined,
  now: string,
): Promise<void> {
  const ids = toSave.map((f) => String(f.id));
  await cascadeSoftDeleteFacultyAssignments(tenant, ids, deletedBy, trimmedReason);
  await cascadeSoftDeleteFacultyEmployDesignations(tenant, ids, deletedBy, trimmedReason);
  await cascadeSoftDeleteFacultyEmployments(tenant, ids, deletedBy, trimmedReason);
  for (const f of toSave) {
    const deletedAt = f.deletedAt ?? now;
    await emitOutboxEvent("entity.soft_deleted", {
      entityType: "faculty",
      entityId: String(f.id),
      tenantId: tenant,
      deletedAt,
      deletedBy,
      deletionReason: f.deletionReason,
      version: new Date(deletedAt).getTime() || Date.now(),
      snapshot: f,
    });
  }
  await revokeFacultySessions(tenant, toSave);
}
