/**
 * Hasanat audit emission — hash-chained evidence for every point-affecting mutation.
 *
 * Points are money-like: issuance, redemption, reversal, tier changes and the point catalogue all
 * move the ledger. The business rows keep "who wrote last"; the audit row keeps the *transition*
 * (actor, before/after, reason) and is appended to the tenant's audit shard inside the same
 * transaction, so a rolled-back mutation never leaves an orphan event and a committed one is never
 * invisible.
 *
 * Callers must already be inside the mutation's transaction (`recordModernAuditEvent` joins the
 * active tx). Snapshots carry ids, amounts and status only — never names or free-text PII.
 */

import type { AuditActionType, Distribution, Redemption } from "@mms/shared";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import type { HasanatStudentAwardView } from "./hasanatTierUseCases.js";

export interface HasanatAuditInput {
  tenant: string;
  /** Authenticated actor; falls back to the request user when omitted. */
  actorUserId?: string | null;
  action: AuditActionType;
  reason?: string | null;
  /** Semantic sub-label stored in `newState.tag` (e.g. `hasanat.redeem`). */
  tag?: string;
  extra?: Record<string, unknown>;
  impersonatedUserId?: string | null;
}

function actorId(input: HasanatAuditInput): string {
  const id = input.actorUserId?.trim();
  return id ? id : "system";
}

function cardSnapshot(card: Distribution): Record<string, unknown> {
  return {
    studentId: card.recipientStudentId ?? null,
    facultyId: card.recipientFacultyId ?? null,
    classId: card.classId ?? null,
    sessionId: card.sessionId ?? null,
    batchId: card.batchId,
    denominationId: card.denominationId,
    quantity: card.quantity,
    pointsSnapshot: card.pointsSnapshot ?? null,
    status: card.status,
    issuedDate: card.issuedDate,
    expiresOn: card.expiresOn ?? null,
    deletedAt: card.deletedAt ?? null,
    version: card.version ?? null,
  };
}

function ledgerSnapshot(redemption: Redemption): Record<string, unknown> {
  return {
    distributionId: redemption.distributionId,
    studentId: redemption.studentId ?? null,
    kind: redemption.kind,
    pointsUsed: redemption.pointsUsed,
    reversalOfId: redemption.reversalOfId ?? null,
    date: redemption.date,
    approvedByUserId: redemption.approvedByUserId ?? null,
  };
}

function awardSnapshot(award: HasanatStudentAwardView): Record<string, unknown> {
  return {
    studentId: (award as unknown as { studentId?: string }).studentId ?? null,
    tierKey: award.tierKey,
    tierName: award.tierName,
    earnedSnapshot: award.earnedSnapshot,
    awardedAt: award.awardedAt,
    revokedAt: award.revokedAt ?? null,
    revokedReason: award.revokedReason ?? null,
  };
}

/** Append one audit row; `state` fields are merged into `newState` alongside reason/tag. */
async function append(
  input: HasanatAuditInput,
  tableName: string,
  recordId: string,
  oldState: Record<string, unknown> | null,
  newState: Record<string, unknown>,
): Promise<void> {
  await recordModernAuditEvent({
    workspaceSubdomain: input.tenant.trim().toLowerCase(),
    tableName,
    recordId,
    actionType: input.action,
    realUserId: actorId(input),
    ...(input.impersonatedUserId ? { impersonatedUserId: input.impersonatedUserId } : {}),
    oldState,
    newState: {
      ...newState,
      ...(input.reason ? { reason: input.reason } : {}),
      ...(input.tag ? { tag: input.tag } : {}),
      ...(input.extra ?? {}),
    },
    minimizeDelta: true,
  });
}

/** Card state row when the caller already holds an explicit snapshot (batch inserts). */
export async function auditCardState(
  input: HasanatAuditInput & {
    cardId: string;
    before?: Record<string, unknown> | null;
    after: Record<string, unknown>;
  },
): Promise<void> {
  await append(
    input,
    "hasanat_distributions",
    String(input.cardId),
    input.before ?? null,
    input.after,
  );
}

/** Card issuance / edit / status change / archive / restore. */
export async function auditCardMutation(
  input: HasanatAuditInput & { card: Distribution; before?: Distribution | null },
): Promise<void> {
  await auditCardState({
    ...input,
    cardId: String(input.card.id),
    before: input.before ? cardSnapshot(input.before) : null,
    after: cardSnapshot(input.card),
  });
}

/** Snapshot builder for callers that hold a partial card (batch inserts). */
export const cardAuditSnapshot = cardSnapshot;

/** Redemption (burn) and reversal (void) rows. */
export async function auditLedgerMutation(
  input: HasanatAuditInput & { redemption: Redemption },
): Promise<void> {
  await append(
    input,
    "hasanat_redemptions",
    String(input.redemption.id),
    null,
    ledgerSnapshot(input.redemption),
  );
}

/** Tier award materialization: granted, revoked, or re-granted after a reduction. */
export async function auditAwardMutation(
  input: HasanatAuditInput & {
    award: HasanatStudentAwardView;
    before?: HasanatStudentAwardView | null;
  },
): Promise<void> {
  await append(
    input,
    "hasanat_student_awards",
    String(input.award.id),
    input.before ? awardSnapshot(input.before) : null,
    awardSnapshot(input.award),
  );
}

/** Point-catalogue edits (denominations/batches) and other setup rows. */
export async function auditSetupMutation(
  input: HasanatAuditInput & {
    tableName: string;
    recordId: string;
    before?: Record<string, unknown> | null;
    after: Record<string, unknown>;
  },
): Promise<void> {
  await append(input, input.tableName, input.recordId, input.before ?? null, input.after);
}
