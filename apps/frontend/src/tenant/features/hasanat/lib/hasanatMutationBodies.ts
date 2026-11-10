import type { DistributionWrite } from "@/lib/data/hasanatData";
import type { Distribution, DistributionCreate, DistributionUpdate } from "@mms/shared";

/**
 * Card fields the write API owns; sending them would be rejected by the strict create schema.
 * The per-draft idempotency key is forwarded so a retried award replays instead of duplicating.
 */
export function toCreateBody(distribution: DistributionWrite): DistributionCreate {
  return {
    batchId: distribution.batchId,
    denominationId: distribution.denominationId,
    denominationName: distribution.denominationName ?? "",
    recipientType: distribution.recipientType,
    recipientStudentId: distribution.recipientStudentId ?? null,
    recipientFacultyId: distribution.recipientFacultyId ?? null,
    recipientName: distribution.recipientName ?? "",
    recipientClass: distribution.recipientClass ?? "",
    classId: distribution.classId ?? null,
    sessionId: distribution.sessionId ?? null,
    quantity: distribution.quantity,
    expiresOn: distribution.expiresOn ?? null,
    reason: distribution.reason ?? "",
    issuedDate: distribution.issuedDate,
    issuedByUserId: distribution.issuedByUserId ?? null,
    issuedBy: distribution.issuedBy ?? null,
    ...(distribution.clientRequestId ? { clientRequestId: distribution.clientRequestId } : {}),
  };
}

/** Mutable fields + the OCC token. Value-affecting fields are immutable after issue. */
export function toUpdateBody(distribution: Distribution): DistributionUpdate {
  return {
    recipientType: distribution.recipientType,
    recipientStudentId: distribution.recipientStudentId ?? null,
    recipientFacultyId: distribution.recipientFacultyId ?? null,
    recipientName: distribution.recipientName ?? "",
    recipientClass: distribution.recipientClass ?? "",
    classId: distribution.classId ?? null,
    sessionId: distribution.sessionId ?? null,
    expiresOn: distribution.expiresOn ?? null,
    reason: distribution.reason ?? "",
    expectedVersion: distribution.version ?? 0,
  };
}
