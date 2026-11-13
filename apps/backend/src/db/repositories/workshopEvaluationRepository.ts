import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { WorkshopCompletionStatus } from "@mms/shared";
import { workshopParticipants } from "../schema.js";
import type { TenantTransaction } from "../tenant-context.js";
import { auditRow } from "./workshopAudit.js";

/**
 * Tx-scoped primitives for completion evaluation and certificates.
 *
 * `evaluateCompletion` used to read the roster in one transaction, persist in a second and re-read
 * in a third — a concurrent check-in or withdrawal could be evaluated against a stale snapshot, and
 * the write could downgrade a participant who already held a certificate. Both operations now run
 * against one locked snapshot; the pure rule stays in `@mms/shared`.
 */

/**
 * Stores every participant's evaluated standing in one statement.
 *
 * A participant who already holds a certificate is pinned to `completed` — re-running the
 * evaluation must never downgrade evidence that was already issued (`certificate_issued_at` is
 * immutable in practice), which is what the old per-row update silently did.
 */
export async function saveCompletionOutcomesTx(
  tx: TenantTransaction,
  subdomain: string,
  workshopId: string,
  outcomes: ReadonlyArray<{ participantId: string; status: WorkshopCompletionStatus }>,
): Promise<void> {
  if (outcomes.length === 0) return;
  const ids = outcomes.map((outcome) => outcome.participantId);
  const stateColumns = {
    id: workshopParticipants.id,
    status: workshopParticipants.status,
    completedAt: workshopParticipants.completedAt,
    certificateIssuedAt: workshopParticipants.certificateIssuedAt,
    contactId: workshopParticipants.contactId,
  };
  const before = await tx
    .select(stateColumns)
    .from(workshopParticipants)
    .where(
      and(
        eq(workshopParticipants.workspaceSubdomain, subdomain),
        eq(workshopParticipants.workshopId, workshopId),
        inArray(workshopParticipants.id, ids),
        isNull(workshopParticipants.deletedAt),
      ),
    );
  const values = sql.join(
    outcomes.map((outcome) => sql`(${outcome.participantId}::text, ${outcome.status}::text)`),
    sql`, `,
  );
  await tx.execute(sql`
    UPDATE ${workshopParticipants} p
       SET status = CASE
             WHEN p.certificate_issued_at IS NOT NULL THEN 'completed'
             ELSE v.status
           END,
           completed_at = CASE
             WHEN p.certificate_issued_at IS NOT NULL THEN p.completed_at
             WHEN v.status = 'completed' THEN coalesce(p.completed_at, now())
             ELSE NULL
           END,
           updated_at = now()
      FROM (VALUES ${values}) AS v(id, status)
     WHERE p.workspace_subdomain = ${subdomain}
       AND p.workshop_id = ${workshopId}
       AND p.id = v.id
       AND p.deleted_at IS NULL
  `);
  const after = await tx
    .select(stateColumns)
    .from(workshopParticipants)
    .where(
      and(
        eq(workshopParticipants.workspaceSubdomain, subdomain),
        eq(workshopParticipants.workshopId, workshopId),
        inArray(workshopParticipants.id, ids),
        isNull(workshopParticipants.deletedAt),
      ),
    );
  const beforeById = new Map(before.map((row) => [row.id, row]));
  for (const row of after) {
    const oldState = beforeById.get(row.id);
    const changed =
      !oldState ||
      oldState.status !== row.status ||
      (oldState.completedAt?.getTime() ?? null) !== (row.completedAt?.getTime() ?? null);
    if (!changed) continue;
    await auditRow(tx, {
      workspaceSubdomain: subdomain,
      tableName: "workshop_participants",
      recordId: row.id,
      actionType: "UPDATE",
      subjectId: row.contactId,
      ...(oldState ? { oldState } : {}),
      newState: { ...row, operation: "completion_evaluated" },
    });
  }
}

/** Marks certificates issued for the named completed participants; returns the newly issued ids. */
export async function markCertificatesIssuedTx(
  tx: TenantTransaction,
  subdomain: string,
  workshopId: string,
  participantIds: readonly string[],
): Promise<string[]> {
  const conditions = [
    eq(workshopParticipants.workspaceSubdomain, subdomain),
    eq(workshopParticipants.workshopId, workshopId),
    eq(workshopParticipants.status, "completed"),
    isNull(workshopParticipants.deletedAt),
    isNull(workshopParticipants.certificateIssuedAt),
    sql`${workshopParticipants.completedAt} is not null`,
  ];
  if (participantIds.length > 0) {
    conditions.push(inArray(workshopParticipants.id, [...participantIds]));
  }
  const before = await tx
    .select({
      id: workshopParticipants.id,
      status: workshopParticipants.status,
      completedAt: workshopParticipants.completedAt,
      certificateIssuedAt: workshopParticipants.certificateIssuedAt,
      contactId: workshopParticipants.contactId,
    })
    .from(workshopParticipants)
    .where(and(...conditions));
  const now = new Date();
  const issued = await tx
    .update(workshopParticipants)
    .set({ certificateIssuedAt: now, updatedAt: now })
    .where(and(...conditions))
    .returning({ id: workshopParticipants.id });
  const issuedIds = issued.map((row) => row.id);
  const beforeById = new Map(before.map((row) => [row.id, row]));
  for (const id of issuedIds) {
    const oldState = beforeById.get(id);
    await auditRow(tx, {
      workspaceSubdomain: subdomain,
      tableName: "workshop_participants",
      recordId: id,
      actionType: "UPDATE",
      ...(oldState ? { subjectId: oldState.contactId } : {}),
      ...(oldState ? { oldState } : {}),
      newState: {
        ...(oldState ?? {}),
        certificateIssuedAt: now,
        operation: "certificate_issued",
      },
    });
  }
  return issuedIds;
}
