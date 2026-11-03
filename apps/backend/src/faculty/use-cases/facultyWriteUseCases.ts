import type { FacultyRecord, FacultyWrite } from "@mms/shared";
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
  type FacultyWriteGuards,
} from "./facultyWriteHelpers.js";
import { ConflictError } from "../../lib/httpErrors.js";
import { reconcileContactSystemTags } from "../../contacts/systemTags/contactSystemTagUseCases.js";
import { logger } from "../../lib/logger.js";

export { HierarchyValidationError, HierarchyCycleError } from "./facultyHierarchyValidator.js";

export interface CreateFacultyResult {
  record: FacultyRecord;
  /** True when an archived faculty member with the same contactId was restored instead of inserting. */
  restored: boolean;
}

/** Thrown when a create would un-delete an archived faculty member without delete permission. */
export class FacultyPermissionError extends Error {
  readonly statusCode = 403;
  readonly type = "forbidden";
  constructor(message = "Restoring an archived faculty member requires delete permission") {
    super(message);
    this.name = "FacultyPermissionError";
  }
}

/**
 * Batch writers (CSV import) pass one collector so contact-tag reconciliation
 * and the live-push broadcast run once after the loop instead of per row.
 * See `mms-code-review.md` §8 (batch writers) and `mms-data-layer.md` §9.
 */
export interface FacultyBatchSideEffects {
  contactIds: Set<string>;
}

export interface CreateFacultyOptions {
  /** False when the caller lacks `faculty.delete`; blocks implicit restore. */
  canRestore?: boolean;
  /** DI seam for the DB-backed link guards (unit tests pass fakes). */
  guards?: FacultyWriteGuards;
  /** Present on batch writes: defers reconcile + broadcast to the caller. */
  batch?: FacultyBatchSideEffects;
}

/** Options for the single-record update path (batch deferred side effects optional). */
export interface UpdateFacultyOptions {
  guards?: FacultyWriteGuards;
  /** Present on batch writes: defers reconcile + broadcast to the caller. */
  batch?: FacultyBatchSideEffects;
}

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
 * Creates a faculty member. When the incoming record carries a `contactId` that matches a
 * soft-deleted faculty (re-registration), the archived row is restored in place.
 */
export async function createFaculty(
  record: FacultyRecord | FacultyWrite | Record<string, unknown>,
  repo: FacultyRepository = facultyRepository,
  options: CreateFacultyOptions = {},
): Promise<CreateFacultyResult> {
  const guards = options.guards ?? defaultFacultyWriteGuards;
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
    } else {
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
    });

    if (archived) {
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
          actorId: merged.updatedBy ?? undefined,
        });
      }
      return { record: merged, restored: true };
    }

    await repo.save(tenant, guarded.record, { createOnly: true });
    await guards.syncPrimaryAppointment(tenant, guarded.record, guarded.departmentId);
    if (options.batch) {
      collectFacultyBatchContacts(options.batch, [guarded.record.contactId]);
    } else {
      await reconcileContactSystemTags(tenant, [guarded.record.contactId], {
        actorId: guarded.record.updatedBy ?? undefined,
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
    });

    await repo.save(tenant, guarded.record);
    await guards.syncPrimaryAppointment(tenant, guarded.record, guarded.departmentId);
    if (options.batch) {
      collectFacultyBatchContacts(options.batch, [existing.contactId, guarded.record.contactId]);
    } else {
      await reconcileContactSystemTags(tenant, [existing.contactId, guarded.record.contactId], {
        actorId: guarded.record.updatedBy ?? undefined,
      });
    }
    return guarded.record;
  });
  if (saved && !options.batch) {
    await broadcastCollection("faculty");
  }
  return saved;
}
