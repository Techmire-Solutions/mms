/**
 * Hasanat batch-award persistence — recipient resolution and multi-row inserts.
 *
 * No rules: the batch use case decides who is eligible, what to skip and how to reconcile tiers.
 */

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  SEAT_RELEASED_ENROLLMENT_STATUSES,
  type HasanatBatchRecipient,
  type HasanatBatchTarget,
} from "@mms/shared";
import { hasanatDistributions } from "../schema/hasanatDistributions.js";
import { withTenant, withTenantRead } from "../tenant-context.js";
import { requireDbDateValue } from "../../lib/dbDate.js";

const RELEASED = [...SEAT_RELEASED_ENROLLMENT_STATUSES];

/** Live recipients for a target, resolved in one query (names come from the contact record). */
export async function listBatchRecipients(
  tenant: string,
  target: HasanatBatchTarget,
): Promise<HasanatBatchRecipient[]> {
  const subdomain = tenant.trim().toLowerCase();
  const ids = target.kind === "students" ? Array.from(new Set(target.studentIds)) : [];

  return withTenantRead(subdomain, async (tx) => {
    const targetPredicate =
      target.kind === "students"
        ? sql`e.student_id IN (${sql.join(
            ids.map((id) => sql`${id}`),
            sql`, `,
          )})`
        : sql`e.session_id = ${target.sessionId} AND e.class_id = ${target.classId}${
            target.sectionId ? sql` AND e.section_id = ${target.sectionId}` : sql``
          }`;

    const result = await tx.execute(sql`
      SELECT DISTINCT
             e.student_id AS "studentId",
             COALESCE(NULLIF(btrim(c.name), ''), e.student_name, e.student_id) AS "studentName",
             e.class_id AS "classId",
             e.section_id AS "sectionId",
             e.session_id AS "sessionId"
        FROM enrollments e
        JOIN students st
          ON st.workspace_subdomain = e.workspace_subdomain
         AND st.id = e.student_id
         AND st.deleted_at IS NULL
        LEFT JOIN contacts c
          ON c.workspace_subdomain = st.workspace_subdomain
         AND c.id = st.contact_id
       WHERE e.workspace_subdomain = ${subdomain}
         AND e.deleted_at IS NULL
         AND e.status NOT IN (${sql.join(
           RELEASED.map((status) => sql`${status}`),
           sql`, `,
         )})
         AND ${targetPredicate}
       ORDER BY 1
    `);

    const rows = (result as unknown as { rows?: Array<Record<string, unknown>> }).rows ?? [];
    return rows
      .map((row) => ({
        studentId: String(row.studentId ?? ""),
        studentName: String(row.studentName ?? ""),
        classId: row.classId ? String(row.classId) : null,
        sectionId: row.sectionId ? String(row.sectionId) : null,
        sessionId: row.sessionId ? String(row.sessionId) : null,
      }))
      .filter((row) => row.studentId);
  });
}

export interface NewBatchCard {
  id: string;
  studentId: string;
  studentName: string;
  classId: string | null;
  sessionId: string | null;
  batchId: string;
  denominationId: string;
  denominationName: string;
  quantity: number;
  pointsSnapshot: number;
  clientRequestId: string;
  expiresOn: string | null;
  reason: string;
  issuedDate: string;
  issuedByUserId: string | null;
  issuedBy: string | null;
}

/** One multi-row INSERT per chunk — never one statement per recipient. */
export async function insertBatchDistributions(
  tenant: string,
  cards: readonly NewBatchCard[],
): Promise<string[]> {
  if (cards.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  const CHUNK = 200;
  const insertedIds: string[] = [];

  await withTenant(subdomain, async (tx) => {
    for (let index = 0; index < cards.length; index += CHUNK) {
      const chunk = cards.slice(index, index + CHUNK);
      const rows = await tx
        .insert(hasanatDistributions)
        .values(
          chunk.map((card) => ({
            id: card.id,
            workspaceSubdomain: subdomain,
            batchId: card.batchId,
            denominationId: card.denominationId,
            denominationName: card.denominationName,
            recipientType: "student" as const,
            recipientStudentId: card.studentId,
            recipientFacultyId: null,
            recipientName: card.studentName,
            recipientClass: "",
            classId: card.classId,
            sessionId: card.sessionId,
            quantity: card.quantity,
            pointsSnapshot: card.pointsSnapshot,
            clientRequestId: card.clientRequestId,
            expiresOn: card.expiresOn ? requireDbDateValue(card.expiresOn, "expiresOn") : null,
            reason: card.reason,
            issuedDate: requireDbDateValue(card.issuedDate, "issuedDate"),
            issuedByUserId: card.issuedByUserId,
            issuedBy: card.issuedBy,
            status: "active",
            updatedAt: new Date(),
          })),
        )
        .returning({ id: hasanatDistributions.id });
      insertedIds.push(...rows.map((row) => row.id));
    }
  });

  return insertedIds;
}

/** Existing cards for a set of idempotency keys (replay detection). */
export async function findDistributionsByClientRequestIds(
  tenant: string,
  clientRequestIds: readonly string[],
): Promise<Array<{ id: string; clientRequestId: string; studentId: string | null }>> {
  if (clientRequestIds.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  const CHUNK = 200;
  const found: Array<{ id: string; clientRequestId: string; studentId: string | null }> = [];

  await withTenantRead(subdomain, async (tx) => {
    for (let index = 0; index < clientRequestIds.length; index += CHUNK) {
      const chunk = clientRequestIds.slice(index, index + CHUNK);
      const rows = await tx
        .select({
          id: hasanatDistributions.id,
          clientRequestId: hasanatDistributions.clientRequestId,
          studentId: hasanatDistributions.recipientStudentId,
        })
        .from(hasanatDistributions)
        .where(
          and(
            eq(hasanatDistributions.workspaceSubdomain, subdomain),
            inArray(hasanatDistributions.clientRequestId, [...chunk]),
            isNull(hasanatDistributions.deletedAt),
          ),
        );
      found.push(
        ...rows
          .filter((row) => row.clientRequestId)
          .map((row) => ({
            id: row.id,
            clientRequestId: String(row.clientRequestId),
            studentId: row.studentId ?? null,
          })),
      );
    }
  });

  return found;
}

/** Resolve students by contact name (unique matches only) for name-based CSV imports. */
export async function findStudentsByNames(
  tenant: string,
  names: readonly string[],
): Promise<Array<{ studentId: string; studentName: string }>> {
  const cleaned = Array.from(
    new Set(names.map((name) => name.trim().toLowerCase()).filter(Boolean)),
  );
  if (cleaned.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  const CHUNK = 200;
  const rows: Array<{ studentId: string; studentName: string }> = [];

  await withTenantRead(subdomain, async (tx) => {
    for (let index = 0; index < cleaned.length; index += CHUNK) {
      const chunk = cleaned.slice(index, index + CHUNK);
      const result = await tx.execute(sql`
        SELECT st.id AS "studentId", COALESCE(c.name, '') AS "studentName"
          FROM students st
          LEFT JOIN contacts c
            ON c.workspace_subdomain = st.workspace_subdomain
           AND c.id = st.contact_id
         WHERE st.workspace_subdomain = ${subdomain}
           AND st.deleted_at IS NULL
           AND lower(btrim(c.name)) IN (${sql.join(
             chunk.map((name) => sql`${name}`),
             sql`, `,
           )})
      `);
      const chunkRows = (result as unknown as { rows?: Array<Record<string, unknown>> }).rows ?? [];
      rows.push(
        ...chunkRows.map((row) => ({
          studentId: String(row.studentId ?? ""),
          studentName: String(row.studentName ?? ""),
        })),
      );
    }
  });

  return rows;
}
