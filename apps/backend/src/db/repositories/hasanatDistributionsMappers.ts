/**
 * Hasanat distribution row mapper and inferred row type.
 */

import { type Distribution } from "@mms/shared";
import type { hasanatDistributions } from "../schema.js";
import { mapAuditTimestamps } from "./repositoryMappers.js";

type DistRow = typeof hasanatDistributions.$inferSelect;
export function distributionRowToRecord(row: DistRow): Distribution {
  const dist: Distribution = {
    id: row.id,
    batchId: row.batchId,
    denominationId: row.denominationId,
    denominationName: row.denominationName,
    recipientType: row.recipientType as Distribution["recipientType"],
    recipientName: row.recipientName ?? "",
    recipientClass: row.recipientClass,
    classId: row.classId ?? null,
    quantity: row.quantity,
    reason: row.reason,
    issuedDate: row.issuedDate,
    status: row.status as Distribution["status"],
    ...mapAuditTimestamps(row),
  };

  if (row.recipientStudentId) dist.recipientStudentId = row.recipientStudentId;
  if (row.recipientFacultyId) dist.recipientFacultyId = row.recipientFacultyId;
  if (row.issuedByUserId) dist.issuedByUserId = row.issuedByUserId;
  if (row.issuedBy) dist.issuedBy = row.issuedBy;

  return dist;
}
