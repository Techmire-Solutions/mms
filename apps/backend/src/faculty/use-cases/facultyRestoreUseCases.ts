import { dedupeTrimmedIds, type Faculty } from "@mms/shared";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { runInTransaction } from "../../db/database.js";
import { broadcastCollection } from "../../lib/livePush.js";
import type { FacultyRepository } from "../repository/facultyRepository.js";
import { facultyRepository } from "../repository/facultyRepositoryAdapter.js";
import { ConflictError } from "../../lib/httpErrors.js";
import { isUniqueViolation } from "../../lib/pgErrors.js";
import { buildRestoredRecord, nowIso } from "../../lib/softDeleteHelpers.js";
import { emitOutboxEvent } from "../../services/outboxEventService.js";
import { cascadeRestoreFacultyAssignments } from "../../db/repositories/facultyAssignmentCascade.js";
import { cascadeRestoreFacultyEmployments } from "../../db/repositories/facultyEmploymentRepository.js";
import { cascadeRestoreFacultyEmployDesignations } from "../../db/repositories/facultyEmployDesignationRepository.js";
export async function restoreFacultyById(
  id: string,
  userId?: string,
  repo: FacultyRepository = facultyRepository,
): Promise<Faculty | null> {
  const restored = await runInTransaction(async () => {
    const tenant = getRequestTenant();
    if (!tenant) return null;
    const existing = await repo.findById(tenant, id);
    if (!existing) return null;
    if (!existing.deletedAt) return existing;

    if (existing.employeeId) {
      const conflict = await repo.findRegistrationConflict(tenant, {
        excludeId: id,
        employeeId: existing.employeeId,
      });
      if (conflict === "employeeId") {
        throw new ConflictError(
          `Employee ID ${existing.employeeId} is already in use by another active faculty`,
        );
      }
    }

    const next = buildRestoredRecord(existing, userId);
    try {
      await repo.save(tenant, next);
      await cascadeRestoreFacultyAssignments(tenant, [id], userId);
      await cascadeRestoreFacultyEmployments(tenant, [id], userId);
      await cascadeRestoreFacultyEmployDesignations(tenant, [id], userId);
    } catch (err: unknown) {
      if (
        isUniqueViolation(err) ||
        (typeof err === "object" &&
          err !== null &&
          "code" in err &&
          (err as { code: unknown }).code === "23505")
      ) {
        throw new ConflictError(
          "Cannot restore faculty: active record with this unique identifier already exists",
        );
      }
      throw err;
    }

    const restoredAt = next.restoredAt ?? nowIso();
    await emitOutboxEvent("entity.restored", {
      entityType: "faculty",
      entityId: String(id),
      tenantId: tenant,
      restoredAt,
      restoredBy: userId ?? "unknown",
      version: Date.now(),
    });

    return next;
  });

  if (restored) {
    await broadcastCollection("faculty");
  }
  return restored;
}

export async function bulkRestoreFaculty(
  ids: string[],
  userId?: string,
  repo: FacultyRepository = facultyRepository,
): Promise<{ succeeded: number; failed: number }> {
  const uniqueIds = dedupeTrimmedIds(ids);
  if (uniqueIds.length === 0) return { succeeded: 0, failed: 0 };
  const result = await runInTransaction(async () => {
    const tenant = getRequestTenant();
    if (!tenant) return { succeeded: 0, failed: uniqueIds.length };
    let succeeded = 0;
    let failed = 0;
    const toSave: Faculty[] = [];

    const existingMembers = await repo.findByIds(tenant, uniqueIds);
    const existingMap = new Map(existingMembers.map((m) => [String(m.id), m]));

    for (const id of uniqueIds) {
      const existing = existingMap.get(id);
      if (!existing || !existing.deletedAt) {
        failed += 1;
        continue;
      }
      toSave.push(buildRestoredRecord(existing, userId));
      succeeded += 1;
    }

    if (toSave.length > 0) {
      try {
        await repo.bulkSave(tenant, toSave);
        await cascadeRestoreFacultyAssignments(
          tenant,
          toSave.map((m) => String(m.id)),
          userId,
        );
        await cascadeRestoreFacultyEmployments(
          tenant,
          toSave.map((m) => String(m.id)),
          userId,
        );
        await cascadeRestoreFacultyEmployDesignations(
          tenant,
          toSave.map((m) => String(m.id)),
          userId,
        );
      } catch (err: unknown) {
        if (
          isUniqueViolation(err) ||
          (typeof err === "object" &&
            err !== null &&
            "code" in err &&
            (err as { code: unknown }).code === "23505")
        ) {
          throw new ConflictError(
            "Cannot restore faculty: active record with this unique identifier already exists",
          );
        }
        throw err;
      }

      for (const m of toSave) {
        await emitOutboxEvent("entity.restored", {
          entityType: "faculty",
          entityId: String(m.id),
          tenantId: tenant,
          restoredAt: m.restoredAt ?? nowIso(),
          restoredBy: userId ?? "unknown",
          version: Date.now(),
        });
      }
    }
    return { succeeded, failed };
  });

  if (result.succeeded > 0) {
    await broadcastCollection("faculty");
  }
  return result;
}
