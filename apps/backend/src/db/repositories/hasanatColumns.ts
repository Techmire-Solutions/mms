/**
 * Explicit column projections for the hasanat tables.
 *
 * A single map per table keeps the zero-wildcard ratchet (`check:db-projections`) satisfied while
 * making a column addition a one-line change instead of a hunt through every repository.
 */

import { hasanatDistributions, hasanatRedemptions } from "../schema.js";

export const distributionColumns = {
  id: hasanatDistributions.id,
  workspaceSubdomain: hasanatDistributions.workspaceSubdomain,
  batchId: hasanatDistributions.batchId,
  denominationId: hasanatDistributions.denominationId,
  denominationName: hasanatDistributions.denominationName,
  recipientType: hasanatDistributions.recipientType,
  recipientStudentId: hasanatDistributions.recipientStudentId,
  recipientFacultyId: hasanatDistributions.recipientFacultyId,
  recipientName: hasanatDistributions.recipientName,
  recipientClass: hasanatDistributions.recipientClass,
  classId: hasanatDistributions.classId,
  sessionId: hasanatDistributions.sessionId,
  pointsSnapshot: hasanatDistributions.pointsSnapshot,
  version: hasanatDistributions.version,
  clientRequestId: hasanatDistributions.clientRequestId,
  expiresOn: hasanatDistributions.expiresOn,
  quantity: hasanatDistributions.quantity,
  reason: hasanatDistributions.reason,
  issuedDate: hasanatDistributions.issuedDate,
  issuedByUserId: hasanatDistributions.issuedByUserId,
  issuedBy: hasanatDistributions.issuedBy,
  status: hasanatDistributions.status,
  deletedAt: hasanatDistributions.deletedAt,
  deletedBy: hasanatDistributions.deletedBy,
  deletionReason: hasanatDistributions.deletionReason,
  restoredAt: hasanatDistributions.restoredAt,
  restoredBy: hasanatDistributions.restoredBy,
  deletedWithCascade: hasanatDistributions.deletedWithCascade,
  createdAt: hasanatDistributions.createdAt,
  updatedAt: hasanatDistributions.updatedAt,
} as const;

export const redemptionColumns = {
  id: hasanatRedemptions.id,
  workspaceSubdomain: hasanatRedemptions.workspaceSubdomain,
  distributionId: hasanatRedemptions.distributionId,
  studentId: hasanatRedemptions.studentId,
  studentName: hasanatRedemptions.studentName,
  reward: hasanatRedemptions.reward,
  pointsUsed: hasanatRedemptions.pointsUsed,
  kind: hasanatRedemptions.kind,
  reversalOfId: hasanatRedemptions.reversalOfId,
  clientRequestId: hasanatRedemptions.clientRequestId,
  date: hasanatRedemptions.date,
  approvedByUserId: hasanatRedemptions.approvedByUserId,
  approvedBy: hasanatRedemptions.approvedBy,
  updatedAt: hasanatRedemptions.updatedAt,
  createdAt: hasanatRedemptions.createdAt,
} as const;
