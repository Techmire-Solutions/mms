import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { dedupeTrimmedIds } from "@mms/contracts";
import { getDb } from "@mms/db/client";
import { contacts } from "@mms/db/schema";
import { getRequestTenant } from "@mms/be-core/http";
import { broadcastCollection } from "@mms/be-core/realtime";
import { emitOutboxEvents } from "@mms/be-core/data/outbox";
import { recordModernAuditEvent } from "@mms/be-core/audit";
import type { ContactsRepository } from "../repository/contactsRepository.js";
import { contactsRepository } from "../repository/contactsRepositoryAdapter.js";
import { invalidateDuplicateScanCache } from "./contactDuplicateScanUseCases.js";

export interface ContactBulkPermanentDeleteResult {
  succeeded: number;
  failed: number;
  blocked?: Array<{ id: string; message: string }>;
}

/**
 * Permanently deletes already-trashed (`deleted_at IS NOT NULL`) contacts for the active tenant.
 * Enforces FK dependent blockers, transaction-local `app.allow_hard_purge = 'true'`,
 * immutable audit trail recording, and CDC outbox tombstone emission.
 */
export async function bulkPermanentDeleteContacts(
  ids: string[],
  actorId: string,
  repo: ContactsRepository = contactsRepository,
): Promise<ContactBulkPermanentDeleteResult> {
  const requestedIds = dedupeTrimmedIds(ids);
  if (requestedIds.length === 0) return { succeeded: 0, failed: 0 };
  const tenant = getRequestTenant();
  if (!tenant) return { succeeded: 0, failed: requestedIds.length };

  let blocked: Array<{ id: string; message: string }> = [];
  if (repo.findDeleteBlockers) {
    const blockers = await repo.findDeleteBlockers(tenant, requestedIds);
    const requested = new Set(requestedIds);
    blocked = blockers
      .filter((b) => requested.has(b.contactId))
      .map((b) => ({ id: b.contactId, message: b.message }));
  } else if (repo.guardDeleteDependents) {
    await repo.guardDeleteDependents(tenant, requestedIds);
  }
  const blockedIds = new Set(blocked.map((b) => b.id));
  const candidateIds = requestedIds.filter((id) => !blockedIds.has(id));
  const withBlocked = (outcome: { succeeded: number; failed: number }) =>
    blocked.length > 0 ? { ...outcome, failed: outcome.failed + blocked.length, blocked } : outcome;
  if (candidateIds.length === 0) return withBlocked({ succeeded: 0, failed: 0 });

  const subdomain = tenant.trim().toLowerCase();
  const purgedIds = await getDb().transaction(async (tx) => {
    await tx.execute(sql`SELECT
      set_config('app.current_tenant', ${subdomain}, true),
      set_config('app.current_tenant_id', ${subdomain}, true),
      set_config('app.include_deleted', 'true', true),
      set_config('app.allow_hard_purge', 'true', true)`);

    const deleted = await tx
      .delete(contacts)
      .where(
        and(
          eq(contacts.workspaceSubdomain, subdomain),
          inArray(contacts.id, candidateIds),
          isNotNull(contacts.deletedAt),
        ),
      )
      .returning({ id: contacts.id });

    const idsRemoved = deleted.map((row) => String(row.id));
    if (idsRemoved.length > 0) {
      const nowIso = new Date().toISOString();
      await emitOutboxEvents(
        idsRemoved.map((id, i) => ({
          type: "entity.hard_purge" as const,
          payload: {
            entityType: "contacts",
            entityId: id,
            tenantId: subdomain,
            purgedAt: nowIso,
            version: Date.now() + i,
          },
        })),
      );
      for (const id of idsRemoved) {
        await recordModernAuditEvent({
          workspaceSubdomain: subdomain,
          tableName: "contacts",
          recordId: id,
          actionType: "DELETE",
          realUserId: actorId,
          subjectId: id,
          oldState: { event: "contact.permanent_delete", contactId: id },
          newState: null,
        });
      }
    }
    return idsRemoved;
  });

  if (purgedIds.length > 0) {
    await invalidateDuplicateScanCache();
    await broadcastCollection("contacts");
  }

  return withBlocked({
    succeeded: purgedIds.length,
    failed: candidateIds.length - purgedIds.length,
  });
}

export async function permanentDeleteContactById(
  id: string,
  actorId: string,
  repo: ContactsRepository = contactsRepository,
): Promise<boolean> {
  const tenant = getRequestTenant();
  if (tenant && repo.guardDeleteDependents) await repo.guardDeleteDependents(tenant, [id]);
  const result = await bulkPermanentDeleteContacts([id], actorId, repo);
  return result.succeeded === 1;
}
