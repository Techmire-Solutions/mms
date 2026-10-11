import { dedupeTrimmedIds, type Contact } from "@mms/shared";
import { invalidateDuplicateScanCache } from "./contactDuplicateScanUseCases.js";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { runInTransaction } from "../../db/database.js";
import { broadcastCollection } from "../../lib/livePush.js";
import type { ContactsRepository } from "../repository/contactsRepository.js";

import { contactsRepository } from "../repository/contactsRepositoryAdapter.js";
import { emitOutboxEvent } from "../../services/outboxEventService.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import { buildContactForensicSnapshot } from "../../services/forensicSnapshotService.js";

export {
  type ContactBulkRestoreConflict,
  type ContactBulkRestoreResult,
  restoreContactById,
  bulkRestoreContacts,
} from "./contactRestoreUseCases.js";

export async function softDeleteContactById(
  id: string,
  deletedBy: string,
  deletionReason?: string,
  repo: ContactsRepository = contactsRepository,
): Promise<boolean> {
  const result = await bulkSoftDeleteContacts([id], deletedBy, deletionReason, repo);
  return result.succeeded === 1;
}

export async function bulkSoftDeleteContacts(
  ids: string[],
  deletedBy: string,
  deletionReason?: string,
  repo: ContactsRepository = contactsRepository,
): Promise<{ succeeded: number; failed: number }> {
  const uniqueIds = dedupeTrimmedIds(ids);
  if (uniqueIds.length === 0) return { succeeded: 0, failed: 0 };
  const tenant = getRequestTenant();
  if (!tenant) return { succeeded: 0, failed: uniqueIds.length };

  const result = await runInTransaction(async () => {
    if (repo.guardDeleteDependents) {
      await repo.guardDeleteDependents(tenant, uniqueIds);
    }
    let outcome: { succeeded: number; failed: number };
    const now = new Date().toISOString();
    const trimmedReason = deletionReason?.trim();

    const existingContacts = (await repo.findByIds(tenant, uniqueIds)) ?? [];
    const existingMap = new Map(existingContacts.map((c) => [String(c.id), c]));
    const toDeleteContacts: Contact[] = [];

    for (const id of uniqueIds) {
      const existing = existingMap.get(String(id));
      if (existing && !existing.deletedAt) {
        toDeleteContacts.push({
          ...existing,
          deletedAt: now,
          deletedBy,
          deletionReason: trimmedReason || undefined,
        });
      }
    }

    if (repo.bulkSoftDelete) {
      outcome = await repo.bulkSoftDelete(tenant, uniqueIds, deletedBy, deletionReason);
    } else {
      let succeeded = 0;
      if (toDeleteContacts.length > 0) {
        await repo.bulkSave(tenant, toDeleteContacts);
        succeeded = toDeleteContacts.length;
      }
      outcome = {
        succeeded,
        failed: uniqueIds.length - succeeded,
      };
    }

    if (outcome.succeeded > 0) {
      await invalidateDuplicateScanCache();

      // Emit CDC outbox + audit for each archived contact within the same tx
      if (toDeleteContacts.length > 0) {
        for (const c of toDeleteContacts) {
          await emitOutboxEvent("entity.soft_deleted", {
            entityType: "contacts",
            entityId: String(c.id),
            tenantId: tenant,
            deletedAt: (c.deletedAt as string | undefined) ?? now,
            deletedBy,
            deletionReason: c.deletionReason,
            version: Date.now(),
            snapshot: buildContactForensicSnapshot(c),
          });
          await recordModernAuditEvent({
            workspaceSubdomain: tenant,
            tableName: "contacts",
            recordId: String(c.id),
            actionType: "DELETE",
            oldState: c,
            minimizeDelta: false,
          });
        }
      } else {
        // Fallback for mocked repos where findByIds is not populated
        for (const id of uniqueIds) {
          await emitOutboxEvent("entity.soft_deleted", {
            entityType: "contacts",
            entityId: String(id),
            tenantId: tenant,
            deletedAt: now,
            deletedBy,
            deletionReason: trimmedReason || undefined,
            version: Date.now(),
          });
        }
      }
    }

    return outcome;
  });

  if (result.succeeded > 0) await broadcastCollection("contacts");
  return result;
}
