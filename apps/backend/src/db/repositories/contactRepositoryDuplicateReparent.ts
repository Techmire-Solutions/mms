import { sql } from "drizzle-orm";
import {
  contactRelationships,
  students,
  facultyEmployments,
  workshopParticipants,
  financeInvoices,
  tenantUsers,
  messageLogs,
  orphanProfiles,
} from "../schema.js";
import { withTenant } from "../tenant-context.js";

/**
 * Re-parents every reference to the merged-away contact when merging `deleteId`
 * into `keepId` (soft-delete.md §3, mms-data-layer.md §6.12).
 *
 * The set follows the foreign-key graph, not the module list: any table holding a
 * contact id must be re-pointed, or the merged-away row (soft-deleted, and later
 * hard-purged) leaves the surviving person detached from their own records.
 *
 * `faculty.contact_id` is intentionally absent — migration 0160 dropped that
 * mirror column; the owning column is `faculty_employments.contact_id`.
 */
export async function reparentContactReferences(
  tenant: string,
  keepId: string,
  deleteId: string,
  deletedBy?: string,
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  const mergeReason = `Merged into ${keepId}`;
  await withTenant(subdomain, async (tx) => {
    await tx.execute(sql`
      DELETE FROM ${contactRelationships}
      WHERE workspace_subdomain = ${subdomain}
        AND (
          (contact_id = ${keepId} AND related_contact_id = ${deleteId})
          OR (contact_id = ${deleteId} AND related_contact_id = ${keepId})
          OR (contact_id = ${deleteId} AND related_contact_id = ${deleteId})
        )
    `);

    await tx.execute(sql`
      DELETE FROM ${contactRelationships} cr_delete
      WHERE workspace_subdomain = ${subdomain}
        AND related_contact_id = ${deleteId}
        AND EXISTS (
          SELECT 1 FROM ${contactRelationships} cr_keep
          WHERE cr_keep.workspace_subdomain = cr_delete.workspace_subdomain
            AND cr_keep.contact_id = cr_delete.contact_id
            AND cr_keep.related_contact_id = ${keepId}
            AND cr_keep.relationship = cr_delete.relationship
        )
    `);

    await tx.execute(sql`
      DELETE FROM ${contactRelationships} cr_delete
      WHERE workspace_subdomain = ${subdomain}
        AND contact_id = ${deleteId}
        AND EXISTS (
          SELECT 1 FROM ${contactRelationships} cr_keep
          WHERE cr_keep.workspace_subdomain = cr_delete.workspace_subdomain
            AND cr_keep.contact_id = ${keepId}
            AND cr_keep.related_contact_id = cr_delete.related_contact_id
            AND cr_keep.relationship = cr_delete.relationship
        )
    `);

    await tx.execute(sql`
      UPDATE ${contactRelationships}
      SET related_contact_id = ${keepId}
      WHERE workspace_subdomain = ${subdomain}
        AND related_contact_id = ${deleteId}
    `);
    await tx.execute(sql`
      UPDATE ${contactRelationships}
      SET contact_id = ${keepId},
          id = concat('rel-m-', id, '-', substr(md5(random()::text), 1, 6))
      WHERE workspace_subdomain = ${subdomain}
        AND contact_id = ${deleteId}
    `);

    // Inferred-links provenance must follow the survivor too, or the merged
    // contact's inferred relationships keep pointing at a soft-deleted identity.
    await tx.execute(sql`
      UPDATE ${contactRelationships}
      SET inferred_from_contact_id = ${keepId}
      WHERE workspace_subdomain = ${subdomain}
        AND inferred_from_contact_id = ${deleteId}
    `);

    await tx.execute(sql`
      UPDATE ${students}
      SET contact_id = CASE WHEN contact_id = ${deleteId} THEN ${keepId} ELSE contact_id END,
          guardian_contact_id = CASE WHEN guardian_contact_id = ${deleteId} THEN ${keepId} ELSE guardian_contact_id END,
          father_contact_id = CASE WHEN father_contact_id = ${deleteId} THEN ${keepId} ELSE father_contact_id END,
          mother_contact_id = CASE WHEN mother_contact_id = ${deleteId} THEN ${keepId} ELSE mother_contact_id END
      WHERE workspace_subdomain = ${subdomain}
        AND (${deleteId} IN (contact_id, guardian_contact_id, father_contact_id, mother_contact_id))
    `);

    // `faculty_employments_contact_active_uidx` is partial on `deleted_at IS NULL`,
    // so the retired employment is archived first when the survivor already holds
    // one; the re-point below then moves the archived row as history.
    await tx.execute(sql`
      UPDATE ${facultyEmployments}
      SET deleted_at = now(),
          deleted_by = ${deletedBy ?? null},
          deletion_reason = ${mergeReason},
          updated_at = now()
      WHERE workspace_subdomain = ${subdomain}
        AND contact_id = ${deleteId}
        AND deleted_at IS NULL
        AND EXISTS (
          SELECT 1 FROM ${facultyEmployments} keep_row
          WHERE keep_row.workspace_subdomain = ${subdomain}
            AND keep_row.contact_id = ${keepId}
            AND keep_row.deleted_at IS NULL
        )
    `);
    await tx.execute(sql`
      UPDATE ${facultyEmployments}
      SET contact_id = ${keepId}
      WHERE workspace_subdomain = ${subdomain}
        AND contact_id = ${deleteId}
    `);

    // `workshop_participants_contact_uidx` is (workspace, workshop, contact) on active rows:
    // archive the duplicate registration before re-pointing. It must be a soft-delete — a hard
    // DELETE trips `trg_workshop_participants_forbid_hard_delete` (0178) because the merge
    // transaction never sets `app.allow_hard_purge`, and the survivor already holds the seat, so
    // the loser cannot simply be re-pointed.
    await tx.execute(sql`
      UPDATE ${workshopParticipants} loser
      SET deleted_at = now(),
          deleted_by = ${deletedBy ?? null},
          deletion_reason = ${mergeReason},
          deleted_with_cascade = false,
          updated_at = now()
      WHERE loser.workspace_subdomain = ${subdomain}
        AND loser.deleted_at IS NULL
        AND loser.contact_id = ${deleteId}
        AND EXISTS (
          SELECT 1 FROM ${workshopParticipants} keep_row
          WHERE keep_row.workspace_subdomain = loser.workspace_subdomain
            AND keep_row.workshop_id = loser.workshop_id
            AND keep_row.contact_id = ${keepId}
            AND keep_row.deleted_at IS NULL
        )
    `);
    await tx.execute(sql`
      UPDATE ${workshopParticipants}
      SET contact_id = ${keepId}
      WHERE workspace_subdomain = ${subdomain}
        AND contact_id = ${deleteId}
    `);

    await tx.execute(sql`
      UPDATE ${financeInvoices}
      SET family_contact_id = ${keepId}
      WHERE workspace_subdomain = ${subdomain}
        AND family_contact_id = ${deleteId}
    `);

    await tx.execute(sql`
      UPDATE ${tenantUsers}
      SET contact_id = ${keepId}
      WHERE workspace_subdomain = ${subdomain}
        AND contact_id = ${deleteId}
    `);

    await tx.execute(sql`
      UPDATE ${messageLogs}
      SET contact_id = ${keepId}
      WHERE workspace_subdomain = ${subdomain}
        AND contact_id = ${deleteId}
    `);

    // Orphan sponsorship is a contact FK too (`ON DELETE SET NULL`). Without this
    // the merge silently detaches the sponsor and a later purge nulls the link.
    await tx.execute(sql`
      UPDATE ${orphanProfiles}
      SET sponsor_contact_id = ${keepId}
      WHERE workspace_subdomain = ${subdomain}
        AND sponsor_contact_id = ${deleteId}
    `);
  });
}
