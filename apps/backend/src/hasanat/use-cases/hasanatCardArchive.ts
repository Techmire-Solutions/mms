/**
 * Card archive/restore evidence — audit rows (per record) plus CDC outbox (batched).
 *
 * Extracted from the write facade to keep that module inside the 300-line ceiling. Pure writes:
 * callers already run inside the tenant transaction.
 */

import type { Distribution } from "@mms/shared";
import { emitOutboxEvents } from "../../services/outboxEventService.js";
import { auditCardMutation, cardAuditSnapshot } from "./hasanatAudit.js";

/** One audit row per archived card + one batched CDC insert. */
export async function archiveCardEvidence(input: {
  tenant: string;
  cards: readonly Distribution[];
  deletedBy: string;
  reason?: string;
  now?: string;
}): Promise<void> {
  const now = input.now ?? new Date().toISOString();
  for (const before of input.cards) {
    await auditCardMutation({
      tenant: input.tenant,
      actorUserId: input.deletedBy,
      action: "DELETE",
      card: {
        ...before,
        deletedAt: now,
        deletedBy: input.deletedBy,
        deletionReason: input.reason ?? null,
      },
      before,
      reason: input.reason ?? null,
      tag: "hasanat.archive",
    });
  }
  await emitOutboxEvents(
    input.cards.map((before) => ({
      type: "entity.soft_deleted" as const,
      payload: {
        entityType: "hasanat_distributions",
        entityId: String(before.id),
        tenantId: input.tenant,
        deletedAt: now,
        deletedBy: input.deletedBy,
        deletionReason: input.reason,
        version: Date.now(),
        snapshot: cardAuditSnapshot(before),
      },
    })),
  );
}

/** One audit row per restored card + one batched CDC insert. */
export async function restoreCardEvidence(input: {
  tenant: string;
  cards: readonly Distribution[];
  restoredBy?: string | null;
  now?: string;
}): Promise<void> {
  const now = input.now ?? new Date().toISOString();
  for (const before of input.cards) {
    await auditCardMutation({
      tenant: input.tenant,
      actorUserId: input.restoredBy ?? null,
      action: "RESTORE",
      card: { ...before, deletedAt: null, deletedBy: null, deletionReason: null },
      before,
      tag: "hasanat.restore",
    });
  }
  await emitOutboxEvents(
    input.cards.map((before) => ({
      type: "entity.restored" as const,
      payload: {
        entityType: "hasanat_distributions",
        entityId: String(before.id),
        tenantId: input.tenant,
        restoredAt: now,
        restoredBy: input.restoredBy ?? "",
        version: Date.now(),
        snapshot: cardAuditSnapshot(before),
      },
    })),
  );
}
