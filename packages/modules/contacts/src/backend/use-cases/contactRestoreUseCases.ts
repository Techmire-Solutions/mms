import {
  collectUniqueContactFieldValues,
  dedupeTrimmedIds,
  listUniqueContactFieldRefs,
  type Contact,
  type UniqueContactFieldValue,
} from "@mms/contracts";
import { invalidateDuplicateScanCache } from "./contactDuplicateScanUseCases.js";
import { getRequestTenant } from "@mms/be-core/http";
import { runInTransaction } from "@mms/db/client";
import { broadcastCollection } from "@mms/be-core/realtime";
import { ConflictError } from "@mms/be-core/http/errors";
import { isUniqueViolation } from "@mms/be-core/http/errors";
import { assertContactUniqueFields, ContactUniqueFieldError } from "./contactValidationUseCases.js";
import { loadContactWriteContext } from "./contactWriteContext.js";
import type { ContactsRepository } from "../repository/contactsRepository.js";
import { contactsRepository } from "../repository/contactsRepositoryAdapter.js";
import { emitOutboxEvent, emitOutboxEvents } from "@mms/be-core/data/outbox";
import { recordModernAuditEvent } from "@mms/be-core/audit";
import { reconcileContactSystemTags } from "../systemTags/contactSystemTagUseCases.js";

export interface ContactBulkRestoreConflict {
  id: string;
  errors: ContactUniqueFieldError["errors"];
}

export interface ContactBulkRestoreResult {
  succeeded: number;
  failed: number;
  conflicts: ContactBulkRestoreConflict[];
}

export async function restoreContactById(
  id: string,
  userId?: string,
  repo: ContactsRepository = contactsRepository,
): Promise<Contact | null> {
  const context = await loadContactWriteContext();
  const restored = await runInTransaction(async () => {
    const tenant = getRequestTenant();
    if (!tenant) return null;
    // `includeDeleted` sets the soft-delete RLS GUC for the read; the setting is
    // transaction-local, so the subsequent restore write sees the same row.
    const existing = await repo.findById(tenant, id, { includeDeleted: true });
    if (!existing) return null;
    // An already-active contact is not a restore. Returning null makes the route
    // answer 404 and skip the restore audit/outbox row (C-07).
    if (!existing.deletedAt) return null;

    const now = new Date().toISOString();
    const next: Contact = {
      ...existing,
      deletedAt: undefined,
      deletedBy: undefined,
      deletionReason: undefined,
      restoredAt: now,
      restoredBy: userId,
      updatedAt: now,
    };

    // Active-conflict pre-checks live in `assertContactUniqueFields` (email,
    // phone, CNIC, scalars) so a recyclable-unique collision surfaces as a 400
    // `validation_error` with structured fields — not a bare 409 (mms-data-layer §6.10).
    await assertContactUniqueFields(tenant, next, { language: "en", context }, [], repo);

    // 2. Persist with 23505 race condition protection
    try {
      next.updatedAt = await repo.save(tenant, next);
    } catch (err: unknown) {
      if (
        isUniqueViolation(err) ||
        (typeof err === "object" &&
          err !== null &&
          "code" in err &&
          (err as { code: unknown }).code === "23505")
      ) {
        throw new ConflictError(
          "Cannot restore contact: active record with this unique identifier already exists",
        );
      }
      throw err;
    }

    await invalidateDuplicateScanCache();

    const restoredAt = next.restoredAt ?? new Date().toISOString();
    await emitOutboxEvent("entity.restored", {
      entityType: "contacts",
      entityId: String(id),
      tenantId: tenant,
      restoredAt,
      restoredBy: userId ?? "unknown",
      version: Date.now(),
    });
    await recordModernAuditEvent({
      workspaceSubdomain: tenant,
      tableName: "contacts",
      recordId: String(id),
      actionType: "RESTORE",
      subjectId: String(id),
      newState: next,
      minimizeDelta: false,
    });
    await reconcileContactSystemTags(tenant, [String(id)], {
      actorId: userId,
    });
    return next;
  });
  if (restored) await broadcastCollection("contacts");
  return restored;
}

export async function bulkRestoreContacts(
  ids: string[],
  userId?: string,
  repo: ContactsRepository = contactsRepository,
): Promise<ContactBulkRestoreResult> {
  // Duplicate ids in one request must not inflate succeeded/failed (C-08).
  const uniqueIds = dedupeTrimmedIds(ids);
  const context = await loadContactWriteContext();
  const result = await runInTransaction(async () => {
    const tenant = getRequestTenant();
    if (!tenant) return { succeeded: 0, failed: uniqueIds.length, conflicts: [] };
    let succeeded = 0;
    let failed = 0;
    const conflicts: ContactBulkRestoreConflict[] = [];
    const now = new Date().toISOString();
    const toSave: Contact[] = [];
    const accepted: Contact[] = [];

    const existingContacts = await repo.findByIds(tenant, uniqueIds, { includeDeleted: true });
    const existingMap = new Map(existingContacts.map((c) => [String(c.id), c]));

    // First pass: shape every restorable record and pre-fetch the matching peers
    // once, so the uniqueness check does not issue one SQL lookup per record.
    const restorable: Array<{ id: string; restored: Contact }> = [];
    for (const id of uniqueIds) {
      const existing = existingMap.get(String(id));
      if (!(existing && existing.deletedAt)) {
        failed += 1;
        continue;
      }
      restorable.push({
        id: String(id),
        restored: {
          ...existing,
          deletedAt: undefined,
          deletedBy: undefined,
          deletionReason: undefined,
          restoredAt: now,
          restoredBy: userId,
          updatedAt: now,
        },
      });
    }

    const fields = context.fieldConfig?.fields;
    const uniqueFields = fields ? listUniqueContactFieldRefs(fields) : [];
    const peers = await (async () => {
      if (uniqueFields.length === 0 || restorable.length === 0) return [];
      const allValues: UniqueContactFieldValue[] = [];
      for (const { restored } of restorable) {
        allValues.push(
          ...collectUniqueContactFieldValues(restored, uniqueFields, {
            defaultPhoneCountryCode: context.runtimeDefaults.defaultPhoneCountryCode,
          }),
        );
      }
      if (allValues.length === 0) return [];
      const phoneDigits = allValues
        .filter((value) => value.tabId === "phones" && value.fieldKey === "number")
        .map((value) => value.normalized);
      const emails = allValues
        .filter((value) => value.tabId === "emails" && value.fieldKey === "address")
        .map((value) => value.normalized);
      const scalars = allValues
        .filter(
          (value) =>
            !(value.tabId === "phones" && value.fieldKey === "number") &&
            !(value.tabId === "emails" && value.fieldKey === "address"),
        )
        .map((value) => ({ fieldKey: value.fieldKey, normalized: value.normalized }));
      return repo.findActiveContactsMatchingUniqueValues(
        tenant,
        { phoneDigits, emails, scalars },
        restorable.map((r) => r.id),
      );
    })();

    for (const { id, restored } of restorable) {
      try {
        await assertContactUniqueFields(
          tenant,
          restored,
          {
            language: "en",
            additionalPeers: accepted,
            peers,
            context,
          },
          [],
          repo,
        );
        toSave.push(restored);
        accepted.push(restored);
        succeeded += 1;
      } catch (error) {
        if (error instanceof ContactUniqueFieldError) {
          failed += 1;
          conflicts.push({ id, errors: error.errors });
          continue;
        }
        throw error;
      }
    }

    if (toSave.length > 0) {
      try {
        await repo.bulkSave(tenant, toSave);
      } catch (err: unknown) {
        if (
          isUniqueViolation(err) ||
          (typeof err === "object" &&
            err !== null &&
            "code" in err &&
            (err as { code: unknown }).code === "23505")
        ) {
          throw new ConflictError(
            "Cannot restore contact: active record with this unique identifier already exists",
          );
        }
        throw err;
      }
      await invalidateDuplicateScanCache();

      // Emit CDC outbox (one batched insert for the whole restore) + per-row audit
      const restoredAt = new Date().toISOString();
      await emitOutboxEvents(
        toSave.map((c) => ({
          type: "entity.restored" as const,
          payload: {
            entityType: "contacts",
            entityId: String(c.id),
            tenantId: tenant,
            restoredAt,
            restoredBy: userId ?? "unknown",
            version: Date.now(),
          },
        })),
      );
      for (const c of toSave) {
        await recordModernAuditEvent({
          workspaceSubdomain: tenant,
          tableName: "contacts",
          recordId: String(c.id),
          actionType: "RESTORE",
          subjectId: String(c.id),
          newState: c,
          minimizeDelta: false,
        });
      }
      await reconcileContactSystemTags(
        tenant,
        toSave.map((c) => String(c.id)),
        {
          actorId: userId,
        },
      );
    }
    return { succeeded, failed, conflicts };
  });
  if (result.succeeded > 0) await broadcastCollection("contacts");
  return result;
}
