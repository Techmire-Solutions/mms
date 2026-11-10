/**
 * Hasanat card lifecycle use case — status changes and metadata edits.
 *
 * The persisted status moves only through `changeHasanatCardStatus`, which enforces the shared
 * state machine. Edits are compare-and-set on `version` and cannot touch the stamped value.
 */

import {
  type Distribution,
  type DistributionStatusChange,
  type DistributionUpdate,
  validateRecipient,
  validateStatusTransition,
} from "@mms/shared";
import { withTenant } from "../../db/tenant-context.js";
import { ConflictError, NotFoundError } from "../../lib/httpErrors.js";
import { throwRuleViolation } from "./hasanatRuleErrors.js";
import type { HasanatRepository } from "../repository/hasanatRepository.js";
import { assertSessionWritable } from "./hasanatSessionGuard.js";

/** Move a card through the legal state machine (`active → redeemed|returned`, `returned → active`). */
export async function changeHasanatCardStatus(
  tenant: string,
  distributionId: string,
  input: DistributionStatusChange,
  repo: HasanatRepository,
): Promise<Distribution> {
  const subdomain = tenant.trim().toLowerCase();

  return withTenant(subdomain, async () => {
    const card = await repo.lockDistributionForUpdate(subdomain, distributionId);
    if (!card) {
      throw new NotFoundError("Hasanat card not found");
    }
    await assertSessionWritable(subdomain, card.sessionId);
    if (card.version !== undefined && card.version !== input.expectedVersion) {
      throw new ConflictError(
        "This card changed since you loaded it. Reload and try again.",
        "stale_card_version",
        { currentVersion: card.version, expectedVersion: input.expectedVersion },
      );
    }

    const rule = validateStatusTransition(card.status, input.status);
    if (!rule.ok) {
      throwRuleViolation(rule.violation);
    }

    const updated = await repo.setDistributionStatus(subdomain, card.id, input.status);
    if (!updated) {
      throw new NotFoundError("Hasanat card not found");
    }
    return updated;
  });
}

/** Edit attribution/metadata. Value-affecting fields are not part of the payload. */
export async function updateHasanatCard(
  tenant: string,
  distributionId: string,
  input: DistributionUpdate,
  repo: HasanatRepository,
): Promise<Distribution> {
  const subdomain = tenant.trim().toLowerCase();
  const { expectedVersion, ...patch } = input;

  return withTenant(subdomain, async () => {
    const card = await repo.lockDistributionForUpdate(subdomain, distributionId);
    if (!card) {
      throw new NotFoundError("Hasanat card not found");
    }
    await assertSessionWritable(subdomain, card.sessionId);
    if (card.deletedAt) {
      throw new ConflictError("Restore this card before editing it.");
    }
    if (card.version !== undefined && card.version !== expectedVersion) {
      throw new ConflictError("This card changed since you loaded it. Reload and try again.");
    }

    const recipientType = patch.recipientType ?? card.recipientType;
    const recipientCheck = validateRecipient(
      recipientType,
      patch.recipientStudentId !== undefined ? patch.recipientStudentId : card.recipientStudentId,
      patch.recipientFacultyId !== undefined ? patch.recipientFacultyId : card.recipientFacultyId,
    );
    if (!recipientCheck.ok) {
      throwRuleViolation(recipientCheck.violation);
    }

    const updated = await repo.updateDistributionVersioned(
      subdomain,
      card.id,
      {
        recipientType,
        recipientStudentId: patch.recipientStudentId ?? card.recipientStudentId ?? null,
        recipientFacultyId: patch.recipientFacultyId ?? card.recipientFacultyId ?? null,
        ...(patch.recipientName !== undefined ? { recipientName: patch.recipientName } : {}),
        ...(patch.recipientClass !== undefined ? { recipientClass: patch.recipientClass } : {}),
        ...(patch.classId !== undefined ? { classId: patch.classId } : {}),
        ...(patch.sessionId !== undefined ? { sessionId: patch.sessionId } : {}),
        ...(patch.expiresOn !== undefined ? { expiresOn: patch.expiresOn } : {}),
        ...(patch.reason !== undefined ? { reason: patch.reason } : {}),
        ...(patch.issuedDate !== undefined ? { issuedDate: patch.issuedDate } : {}),
        ...(patch.issuedByUserId !== undefined ? { issuedByUserId: patch.issuedByUserId } : {}),
        ...(patch.issuedBy !== undefined ? { issuedBy: patch.issuedBy } : {}),
      },
      expectedVersion,
    );
    if (!updated) {
      throw new ConflictError("This card changed since you loaded it. Reload and try again.");
    }
    return updated;
  });
}
