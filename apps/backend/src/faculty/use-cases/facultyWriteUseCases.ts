import {
  normalizeFacultyModulePreferences,
  type FacultyRecord,
  type FacultyWrite,
} from "@mms/shared";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { runInTransaction } from "../../db/database.js";
import { broadcastCollection } from "../../lib/livePush.js";
import type { FacultyRepository } from "../repository/facultyRepository.js";
import { facultyRepository } from "../repository/facultyRepositoryAdapter.js";
import { mergeFacultyPatch, prepareFacultyRecord } from "./facultyNormalizeUseCases.js";
import {
  generateNextFacultyEmployeeId,
  previewNextFacultyEmployeeId,
} from "./facultyEmployeeIdService.js";
import {
  applyFacultyWriteGuards,
  defaultFacultyWriteGuards,
  handleImplicitRestore,
} from "./facultyWriteHelpers.js";
import { ConflictError } from "../../lib/httpErrors.js";
import { reconcileContactSystemTags } from "../../contacts/systemTags/contactSystemTagUseCases.js";
import { logger } from "../../lib/logger.js";
import { appendCollectionAuditInTx } from "../../lib/collectionAuditInTx.js";
import { facultyRoleFingerprint } from "./facultyLinkedUserRoleSync.js";
import { loadFacultyModulePreferences } from "./facultyPreferencesService.js";
import type { FacultyContactRequirements } from "./facultyWriteGuards.js";

import { FacultyPermissionError } from "./facultyWriteTypes.js";
import type {
  CreateFacultyResult,
  FacultyBatchSideEffects,
  CreateFacultyOptions,
  UpdateFacultyOptions,
} from "./facultyWriteTypes.js";
export * from "./facultyWriteTypes.js";

const FACULTY_VERSION_CONFLICT =
  "This faculty member was changed by someone else. Reload it and try again.";

function collectFacultyBatchContacts(
  batch: FacultyBatchSideEffects,
  contactIds: Array<string | number | null | undefined>,
): void {
  for (const value of contactIds) {
    if (value == null) continue;
    const contactId = String(value).trim();
    if (contactId) batch.contactIds.add(contactId);
  }
}

/**
 * Loads the workspace's faculty contact-eligibility requirements. Falls back to
 * the historical defaults (email required, phone not required) when preferences
 * cannot be read, so a transient config read failure never blocks a write.
 */
export async function loadFacultyContactRequirements(): Promise<FacultyContactRequirements> {
  try {
    const settings = normalizeFacultyModulePreferences(await loadFacultyModulePreferences());
    return {
      requireEmail: settings.requireContactEmail,
      requirePhone: settings.requireContactPhone,
    };
  } catch (error: unknown) {
    logger.warn({ err: error }, "Faculty contact requirements load failed; using defaults");
    return { requireEmail: true, requirePhone: false };
  }
}

/**
 * Creates a faculty member. When the incoming record carries a `contactId` that matches a
 * soft-deleted faculty (re-registration), the archived row is restored in place.
 */
export async function createFaculty(
  record: FacultyRecord | FacultyWrite | Record<string, unknown>,
  repo: FacultyRepository = facultyRepository,
  options: CreateFacultyOptions = {},
): Promise<CreateFacultyResult> {
  const guards = options.guards ?? defaultFacultyWriteGuards;
  const contactRequirements =
    options.contactRequirements ?? (await loadFacultyContactRequirements());
  const result = await runInTransaction(async () => {
    const tenant = getRequestTenant();
    if (!tenant) throw new Error("Tenant context required");

    const normalized = prepareFacultyRecord(record);
    if (await repo.findById(tenant, String(normalized.id))) {
      throw new ConflictError("Faculty ID already exists; use the update or restore operation");
    }

    const providedEmployeeId = normalized.employeeId?.trim() ?? "";
    if (!providedEmployeeId) {
      const generated = await generateNextFacultyEmployeeId(tenant);
      normalized.employeeId = generated.employeeId;
    } else if (!options.skipEmployeeIdPreview) {
      try {
        const preview = await previewNextFacultyEmployeeId(tenant);
        if (providedEmployeeId === preview.nextEmployeeId) {
          const generated = await generateNextFacultyEmployeeId(tenant);
          normalized.employeeId = generated.employeeId;
        }
      } catch (error: unknown) {
        // Keep the client-provided ID when the sequence table is unavailable.
        logger.warn(
          { err: error, tenant, employeeId: providedEmployeeId },
          "Faculty employee-id preview failed; keeping client-provided ID",
        );
      }
    }

    const contactId = normalized.contactId != null ? String(normalized.contactId).trim() : "";
    const archived = contactId ? await repo.findSoftDeletedByContactId(tenant, contactId) : null;
    if (archived && options.canRestore === false) throw new FacultyPermissionError();

    const guarded = await applyFacultyWriteGuards(tenant, normalized, guards, {
      excludeFacultyId: archived ? String(archived.id) : undefined,
      designationChanged: true,
      contactChanged: true,
      contactRequirements,
    });

    if (archived) {
      if (options.actorId) guarded.record.updatedBy = options.actorId;
      const merged = await handleImplicitRestore(
        tenant,
        archived as FacultyRecord,
        guarded.record,
        repo.save.bind(repo),
      );
      await guards.syncPrimaryAppointment(tenant, merged, guarded.departmentId);
      if (options.batch) {
        collectFacultyBatchContacts(options.batch, [merged.contactId]);
      } else {
        await reconcileContactSystemTags(tenant, [merged.contactId], {
          actorId: options.actorId,
        });
      }
      // Authoritative audit row commits with the write (mms-data-layer §5.4).
      // CSV import records one queue-level `faculty.import` aggregate row instead.
      if (!options.batch) {
        await appendCollectionAuditInTx({
          tenant,
          tableName: "faculty",
          recordId: String(merged.id),
          action: "faculty.restore",
          summary: `Restored faculty member ${String(merged.id)} via re-registration`,
          realUserId: options.actorId ?? null,
          newState: {
            id: merged.id,
            contactId: merged.contactId,
            designationId: merged.designationId,
            status: merged.status,
          },
          subjectId: String(merged.id),
        });
      }
      return { record: merged, restored: true };
    }

    if (options.actorId) {
      guarded.record.createdBy = options.actorId;
      guarded.record.updatedBy = options.actorId;
    }
    await repo.save(tenant, guarded.record, { createOnly: true });
    await guards.syncPrimaryAppointment(tenant, guarded.record, guarded.departmentId);
    if (options.batch) {
      collectFacultyBatchContacts(options.batch, [guarded.record.contactId]);
    } else {
      await reconcileContactSystemTags(tenant, [guarded.record.contactId], {
        actorId: options.actorId,
      });
      // Authoritative audit row commits with the write (mms-data-layer §5.4).
      // CSV import records one queue-level `faculty.import` aggregate row instead.
      await appendCollectionAuditInTx({
        tenant,
        tableName: "faculty",
        recordId: String(guarded.record.id),
        action: "faculty.create",
        summary: `Created faculty member ${String(guarded.record.id)}`,
        realUserId: options.actorId ?? null,
        newState: {
          id: guarded.record.id,
          contactId: guarded.record.contactId,
          designationId: guarded.record.designationId,
          employeeId: guarded.record.employeeId,
          status: guarded.record.status,
        },
        subjectId: String(guarded.record.id),
      });
    }
    return { record: guarded.record, restored: false };
  });
  if (!options.batch) await broadcastCollection("faculty");
  return result;
}

export async function updateFacultyById(
  id: string,
  record: FacultyRecord | FacultyWrite | Record<string, unknown>,
  repo: FacultyRepository = facultyRepository,
  options: UpdateFacultyOptions = {},
): Promise<FacultyRecord | null> {
  const guards = options.guards ?? defaultFacultyWriteGuards;
  const contactRequirements =
    options.contactRequirements ?? (await loadFacultyContactRequirements());
  const saved = await runInTransaction(async () => {
    const tenant = getRequestTenant();
    if (!tenant) return null;
    const existing = await repo.findById(tenant, id);
    if (!existing || existing.deletedAt) return null;

    const normalized = prepareFacultyRecord({
      ...mergeFacultyPatch(existing, record),
      id,
    });
    const guarded = await applyFacultyWriteGuards(tenant, normalized, guards, {
      excludeFacultyId: id,
      designationChanged: (normalized.designationId ?? null) !== (existing.designationId ?? null),
      contactChanged: String(normalized.contactId ?? "") !== String(existing.contactId ?? ""),
      contactRequirements,
    });
    if (options.actorId) guarded.record.updatedBy = options.actorId;
    // Only a changed contact/designation/tenure can change the linked role.
    const syncRole =
      facultyRoleFingerprint(existing as Record<string, unknown>) !==
      facultyRoleFingerprint(normalized as Record<string, unknown>);

    const versionToken = options.expectedUpdatedAt?.trim();
    if (versionToken) {
      // Optimistic concurrency: the token the caller read must still match the
      // stored `updated_at`, otherwise the edit is a 409 (mms-api-interface §6).
      if (!repo.saveIfVersionMatches) throw new ConflictError(FACULTY_VERSION_CONFLICT);
      const savedWithVersion = await repo.saveIfVersionMatches(
        tenant,
        guarded.record,
        versionToken,
        { syncRole },
      );
      if (!savedWithVersion) throw new ConflictError(FACULTY_VERSION_CONFLICT);
    } else {
      await repo.save(tenant, guarded.record, { syncRole });
    }
    await guards.syncPrimaryAppointment(tenant, guarded.record, guarded.departmentId);
    if (options.batch) {
      collectFacultyBatchContacts(options.batch, [existing.contactId, guarded.record.contactId]);
    } else {
      await reconcileContactSystemTags(tenant, [existing.contactId, guarded.record.contactId], {
        actorId: options.actorId,
      });
      // Authoritative audit row commits with the write (mms-data-layer §5.4).
      await appendCollectionAuditInTx({
        tenant,
        tableName: "faculty",
        recordId: id,
        action: "faculty.update",
        summary: `Updated faculty member ${id}`,
        realUserId: options.actorId ?? null,
        oldState: {
          designationId: existing.designationId,
          status: existing.status,
          specialization: existing.specialization,
        },
        newState: {
          designationId: guarded.record.designationId,
          status: guarded.record.status,
          specialization: guarded.record.specialization,
        },
        subjectId: id,
      });
    }
    return guarded.record;
  });
  if (saved && !options.batch) {
    await broadcastCollection("faculty");
  }
  return saved;
}
