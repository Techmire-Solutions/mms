/**
 * Hasanat ledger primitives — append-only reads and inserts, no business rules.
 *
 * Corrections are reversal rows; nothing here updates a ledger row (the DB forbids it, 0232).
 */

import { and, desc, eq, sql } from "drizzle-orm";
import type { Redemption } from "@mms/shared";
import { hasanatRedemptions } from "../schema.js";
import { withTenant, withTenantRead } from "../tenant-context.js";
import { requireDbDateValue } from "../../lib/dbDate.js";
import { redemptionColumns } from "./hasanatColumns.js";
import { redemptionRowToRecord } from "./hasanatRedemptionsRepository.js";

export interface NewRedemptionFields {
  id: string;
  distributionId: string;
  studentId: string | null;
  studentName: string;
  reward: string;
  pointsUsed: number;
  kind: "redeem" | "reversal";
  reversalOfId: string | null;
  clientRequestId: string | null;
  date: string;
  approvedByUserId: string | null;
  approvedBy: string | null;
}

export async function appendRedemption(
  tenant: string,
  fields: NewRedemptionFields,
): Promise<Redemption> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const [row] = await tx
      .insert(hasanatRedemptions)
      .values({
        id: fields.id,
        workspaceSubdomain: subdomain,
        distributionId: fields.distributionId,
        studentId: fields.studentId,
        studentName: fields.studentName,
        reward: fields.reward,
        pointsUsed: fields.pointsUsed,
        kind: fields.kind,
        reversalOfId: fields.reversalOfId,
        clientRequestId: fields.clientRequestId,
        date: requireDbDateValue(fields.date, "date"),
        approvedByUserId: fields.approvedByUserId,
        approvedBy: fields.approvedBy,
        updatedAt: new Date(),
      })
      .returning();
    return redemptionRowToRecord(row);
  });
}

export async function findRedemptionByClientRequestId(
  tenant: string,
  clientRequestId: string,
): Promise<Redemption | null> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select(redemptionColumns)
      .from(hasanatRedemptions)
      .where(
        and(
          eq(hasanatRedemptions.workspaceSubdomain, subdomain),
          eq(hasanatRedemptions.clientRequestId, clientRequestId),
        ),
      )
      .orderBy(desc(hasanatRedemptions.createdAt))
      .limit(1);
    return rows[0] ? redemptionRowToRecord(rows[0]) : null;
  });
}

/** The redemption that currently consumes the card's value, if any (excludes reversed rows). */
export async function findLiveRedemptionForCard(
  tenant: string,
  distributionId: string,
): Promise<Redemption | null> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select(redemptionColumns)
      .from(hasanatRedemptions)
      .where(
        and(
          eq(hasanatRedemptions.workspaceSubdomain, subdomain),
          eq(hasanatRedemptions.distributionId, distributionId),
          eq(hasanatRedemptions.kind, "redeem"),
          sql`not exists (
            select 1 from hasanat_redemptions rev
             where rev.workspace_subdomain = ${subdomain}
               and rev.reversal_of_id = hasanat_redemptions.id
          )`,
        ),
      )
      .limit(1);
    return rows[0] ? redemptionRowToRecord(rows[0]) : null;
  });
}

/** A redemption row by id (any kind) — used to validate a reversal target. */
export async function findLedgerRow(tenant: string, id: string): Promise<Redemption | null> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select(redemptionColumns)
      .from(hasanatRedemptions)
      .where(
        and(eq(hasanatRedemptions.workspaceSubdomain, subdomain), eq(hasanatRedemptions.id, id)),
      )
      .limit(1);
    return rows[0] ? redemptionRowToRecord(rows[0]) : null;
  });
}

/** Whether a redemption has already been reversed. */
export async function hasReversal(tenant: string, redemptionId: string): Promise<boolean> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({ id: hasanatRedemptions.id })
      .from(hasanatRedemptions)
      .where(
        and(
          eq(hasanatRedemptions.workspaceSubdomain, subdomain),
          eq(hasanatRedemptions.reversalOfId, redemptionId),
        ),
      )
      .limit(1);
    return rows.length > 0;
  });
}

/** All ledger rows of one card, oldest first — consumed-value maths and audit views. */
export async function listCardLedger(
  tenant: string,
  distributionId: string,
): Promise<Redemption[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select(redemptionColumns)
      .from(hasanatRedemptions)
      .where(
        and(
          eq(hasanatRedemptions.workspaceSubdomain, subdomain),
          eq(hasanatRedemptions.distributionId, distributionId),
        ),
      )
      .orderBy(hasanatRedemptions.createdAt);
    return rows.map(redemptionRowToRecord);
  });
}
