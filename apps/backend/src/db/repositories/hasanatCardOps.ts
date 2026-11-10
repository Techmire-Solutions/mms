/**
 * Hasanat card write primitives — I/O only, no business rules.
 *
 * The issuance, redemption and lifecycle use cases open the transaction (`withTenant`) and call
 * these functions; every `ConflictError`/`NotFoundError` decision is made one layer up, in
 * `hasanat/use-cases/*`.
 */

import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import type { Distribution } from "@mms/shared";
import { hasanatBatches, hasanatDistributions } from "../schema.js";
import { withTenant, withTenantRead } from "../tenant-context.js";
import { requireDbDateValue } from "../../lib/dbDate.js";
import { distributionColumns } from "./hasanatColumns.js";
import { distributionRowToRecord } from "./hasanatDistributionsMappers.js";

type DistributionRow = typeof hasanatDistributions.$inferSelect;

export interface NewCardFields {
  id: string;
  batchId: string;
  denominationId: string;
  denominationName: string;
  recipientType: "student" | "faculty";
  recipientStudentId: string | null;
  recipientFacultyId: string | null;
  recipientName: string;
  recipientClass: string;
  classId: string | null;
  sessionId: string | null;
  quantity: number;
  pointsSnapshot: number;
  clientRequestId: string | null;
  expiresOn: string | null;
  reason: string;
  issuedDate: string;
  issuedByUserId: string | null;
  issuedBy: string | null;
}

export type CardPatch = Partial<
  Pick<
    NewCardFields,
    | "batchId"
    | "denominationId"
    | "recipientType"
    | "recipientStudentId"
    | "recipientFacultyId"
    | "recipientName"
    | "recipientClass"
    | "classId"
    | "sessionId"
    | "quantity"
    | "expiresOn"
    | "reason"
    | "issuedDate"
    | "issuedByUserId"
    | "issuedBy"
  >
>;

/** Lock the card row for the rest of the transaction (serializes redeem vs. edit vs. reverse). */
export async function lockDistributionForUpdate(
  tenant: string,
  id: string,
): Promise<Distribution | null> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const rows = await tx
      .select(distributionColumns)
      .from(hasanatDistributions)
      .where(
        and(
          eq(hasanatDistributions.workspaceSubdomain, subdomain),
          eq(hasanatDistributions.id, id),
        ),
      )
      .for("update")
      .limit(1);
    return rows[0] ? distributionRowToRecord(rows[0]) : null;
  });
}

/** Plain insert — the caller has already validated every rule and stamped the value. */
export async function insertDistribution(
  tenant: string,
  fields: NewCardFields,
): Promise<Distribution> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const [row] = await tx
      .insert(hasanatDistributions)
      .values({
        id: fields.id,
        workspaceSubdomain: subdomain,
        batchId: fields.batchId,
        denominationId: fields.denominationId,
        denominationName: fields.denominationName,
        recipientType: fields.recipientType,
        recipientStudentId: fields.recipientStudentId,
        recipientFacultyId: fields.recipientFacultyId,
        recipientName: fields.recipientName,
        recipientClass: fields.recipientClass,
        classId: fields.classId,
        sessionId: fields.sessionId,
        quantity: fields.quantity,
        pointsSnapshot: fields.pointsSnapshot,
        clientRequestId: fields.clientRequestId,
        expiresOn: fields.expiresOn ? requireDbDateValue(fields.expiresOn, "expiresOn") : null,
        reason: fields.reason,
        issuedDate: requireDbDateValue(fields.issuedDate, "issuedDate"),
        issuedByUserId: fields.issuedByUserId,
        issuedBy: fields.issuedBy,
        status: "active",
        updatedAt: new Date(),
      })
      .returning();
    return distributionRowToRecord(row);
  });
}

/** Compare-and-set on `version`; `null` means the caller's copy was stale. */
export async function updateDistributionVersioned(
  tenant: string,
  id: string,
  patch: CardPatch,
  expectedVersion: number,
): Promise<Distribution | null> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const rows = await tx
      .update(hasanatDistributions)
      .set({
        ...patch,
        ...(patch.expiresOn !== undefined
          ? {
              expiresOn: patch.expiresOn ? requireDbDateValue(patch.expiresOn, "expiresOn") : null,
            }
          : {}),
        ...(patch.issuedDate !== undefined
          ? { issuedDate: requireDbDateValue(patch.issuedDate, "issuedDate") }
          : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(hasanatDistributions.workspaceSubdomain, subdomain),
          eq(hasanatDistributions.id, id),
          eq(hasanatDistributions.version, expectedVersion),
        ),
      )
      .returning();
    return rows[0] ? distributionRowToRecord(rows[0]) : null;
  });
}

/** Status write used only by the lifecycle/redeem/reverse use cases after their rules pass. */
export async function setDistributionStatus(
  tenant: string,
  id: string,
  status: Distribution["status"],
): Promise<Distribution | null> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const rows = await tx
      .update(hasanatDistributions)
      .set({ status, updatedAt: new Date() })
      .where(
        and(
          eq(hasanatDistributions.workspaceSubdomain, subdomain),
          eq(hasanatDistributions.id, id),
        ),
      )
      .returning();
    return rows[0] ? distributionRowToRecord(rows[0]) : null;
  });
}

/** Cards issued by one instructor on one calendar day — the quota input. */
export async function countIssuedByUserOnDate(
  tenant: string,
  userId: string,
  issuedDate: string,
): Promise<number> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const [row] = await tx
      .select({ total: count() })
      .from(hasanatDistributions)
      .where(
        and(
          eq(hasanatDistributions.workspaceSubdomain, subdomain),
          eq(hasanatDistributions.issuedByUserId, userId),
          eq(hasanatDistributions.issuedDate, issuedDate),
          isNull(hasanatDistributions.deletedAt),
        ),
      );
    return Number(row?.total ?? 0);
  });
}

/**
 * Serialize a check-then-insert per (tenant, instructor, day).
 * Same transaction-scoped advisory-lock pattern as `attendanceLeaveRepository`.
 */
export async function lockInstructorQuota(
  tenant: string,
  userId: string,
  issuedDate: string,
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${`hasanat:quota:${subdomain}:${userId}:${issuedDate}`}))`,
    );
  });
}

/** Idempotent replay lookup for issuance. */
export async function findDistributionByClientRequestId(
  tenant: string,
  clientRequestId: string,
): Promise<Distribution | null> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select(distributionColumns)
      .from(hasanatDistributions)
      .where(
        and(
          eq(hasanatDistributions.workspaceSubdomain, subdomain),
          eq(hasanatDistributions.clientRequestId, clientRequestId),
        ),
      )
      .orderBy(desc(hasanatDistributions.createdAt))
      .limit(1);
    return rows[0] ? distributionRowToRecord(rows[0]) : null;
  });
}

/** Live stock of a batch (the DB projection owner), or `null` when the batch is gone. */
export async function findBatchRemaining(tenant: string, batchId: string): Promise<number | null> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({ remaining: hasanatBatches.remaining })
      .from(hasanatBatches)
      .where(and(eq(hasanatBatches.workspaceSubdomain, subdomain), eq(hasanatBatches.id, batchId)))
      .limit(1);
    return rows[0] ? rows[0].remaining : null;
  });
}

export type { DistributionRow };
export { findSessionIdForClass, findSessionStatuses } from "./hasanatSessionOps.js";
