/**
 * Hasanat batch (group) awarding use case.
 *
 * One request, one transaction: recipients are resolved server-side from live enrollments, the
 * group is validated once, cards are written with a single multi-row insert, and tier evidence is
 * reconciled with one state query. Larger groups are delegated to the `hasanat:bulk-award` job by
 * the caller (see `hasanatBatchAwardUseCases.enqueueBatchAward`).
 */

import {
  batchCardRequestId,
  cardValue,
  generateClientEntityId,
  HASANAT_BATCH_INLINE_MAX,
  validateBatchIssuance,
  type Distribution,
  type HasanatBatchAwardBody,
  type HasanatBatchAwardResult,
  type HasanatBatchRecipient,
  type HasanatBatchTarget,
} from "@mms/shared";
import { workspaceTodayIso } from "../../lib/workspaceDay.js";
import { ConflictError } from "../../lib/httpErrors.js";
import type { HasanatRepository } from "../repository/hasanatRepository.js";
import {
  findDistributionsByClientRequestIds,
  insertBatchDistributions,
  listBatchRecipients,
  type NewBatchCard,
} from "../repository/hasanatRepositoryAdapter.js";
import { reconcileTiersForStudents } from "./hasanatTierUseCases.js";
import { assertSessionsWritable } from "./hasanatSessionGuard.js";

export interface BatchAwardActor {
  userId: string;
  displayName?: string | null;
  quotaLimit?: number | null;
}

export async function resolveBatchAwardRecipients(
  tenant: string,
  target: HasanatBatchTarget,
): Promise<HasanatBatchRecipient[]> {
  const subdomain = tenant.trim().toLowerCase();
  return listBatchRecipients(subdomain, target);
}

/**
 * Issues one card per recipient. All-or-nothing: any failure rolls the whole batch back.
 * A replayed `clientRequestId` returns the cards already issued instead of duplicating them.
 */
export async function issueHasanatCardsBatch(
  tenant: string,
  body: HasanatBatchAwardBody,
  actor: BatchAwardActor,
  repo: HasanatRepository,
  options: {
    /** Pre-resolved recipients (avoids a second resolution query). */
    recipients?: readonly HasanatBatchRecipient[];
    /** The background runner disables the inline cap because it feeds ≤ chunk-size slices. */
    enforceInlineCap?: boolean;
  } = {},
): Promise<HasanatBatchAwardResult> {
  const subdomain = tenant.trim().toLowerCase();
  const today = await workspaceTodayIso(subdomain);

  const recipients = options.recipients
    ? [...options.recipients]
    : await listBatchRecipients(subdomain, body.target);
  if (recipients.length === 0) {
    throw new ConflictError("No active students match this batch target.");
  }
  if ((options.enforceInlineCap ?? true) && recipients.length > HASANAT_BATCH_INLINE_MAX) {
    throw new ConflictError(
      `This group has ${recipients.length} recipients; queue it as a background job instead.`,
    );
  }

  const keys = new Map<string, string>();
  for (const recipient of recipients) {
    keys.set(recipient.studentId, batchCardRequestId(body.clientRequestId, recipient.studentId));
  }

  const existing = await findDistributionsByClientRequestIds(subdomain, [...keys.values()]);
  const alreadyIssued = new Set(existing.map((row) => row.clientRequestId));
  const skipped: Array<{ studentId: string; reason: string }> = [];
  const pending = recipients.filter((recipient) => {
    const key = keys.get(recipient.studentId) ?? "";
    if (alreadyIssued.has(key)) {
      skipped.push({ studentId: recipient.studentId, reason: "already_awarded" });
      return false;
    }
    return true;
  });

  if (pending.length === 0) {
    return {
      issued: 0,
      distributionIds: existing.map((row) => row.id),
      skipped,
      queued: false,
    };
  }

  // One query for the whole group: a single closed session blocks the award.
  await assertSessionsWritable(
    subdomain,
    pending.map((recipient) => recipient.sessionId ?? ""),
  );

  const denomination = await repo.findDenomById(subdomain, body.denominationId);
  const batchRemaining = await repo.findBatchRemaining(subdomain, body.batchId);

  // Serialize with concurrent awards for the same instructor/day, then count once.
  await repo.lockInstructorQuota(subdomain, actor.userId, body.issuedDate);
  const quotaUsed = await repo.countIssuedByUserOnDate(subdomain, actor.userId, body.issuedDate);

  const rule = validateBatchIssuance({
    denomination,
    recipientCount: pending.length,
    batchRemaining,
    issuedDate: body.issuedDate,
    today,
    quota: { used: quotaUsed, limit: actor.quotaLimit },
  });
  if (!rule.ok) {
    throw new ConflictError(rule.violation.message);
  }

  const pointsPerUnit = denomination?.points ?? 0;
  const cards: NewBatchCard[] = pending.map((recipient) => ({
    id: generateClientEntityId("hd"),
    studentId: recipient.studentId,
    studentName: recipient.studentName,
    classId: recipient.classId,
    sessionId: recipient.sessionId,
    batchId: body.batchId,
    denominationId: body.denominationId,
    denominationName: denomination?.name ?? "",
    quantity: 1,
    pointsSnapshot: cardValue(pointsPerUnit, 1),
    clientRequestId: keys.get(recipient.studentId) ?? "",
    expiresOn: body.expiresOn ?? null,
    reason: body.reason,
    issuedDate: body.issuedDate,
    issuedByUserId: actor.userId,
    issuedBy: actor.displayName ?? null,
  }));

  const distributionIds = await insertBatchDistributions(subdomain, cards);

  // One state query for the whole group — not one reconcile per student.
  await reconcileTiersForStudents(
    subdomain,
    cards.map((card) => card.studentId),
  );

  return {
    issued: distributionIds.length,
    distributionIds,
    skipped,
    queued: false,
  };
}

/** Cards produced by a batch, for the caller's response envelope. */
export type BatchDistributionIds = Distribution["id"][];
