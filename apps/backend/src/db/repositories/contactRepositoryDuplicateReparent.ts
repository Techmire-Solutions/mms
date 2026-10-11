import { sql } from "drizzle-orm";
import { contactRelationships, students, faculty, tenantUsers, messageLogs } from "../schema.js";
import { withTenant } from "../tenant-context.js";

/** Re-parents relationships and student/teacher/user/message foreign keys when merging deleteId into keepId. */
export async function reparentContactReferences(
  tenant: string,
  keepId: string,
  deleteId: string,
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
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

    await tx.execute(sql`
      UPDATE ${students}
      SET contact_id = CASE WHEN contact_id = ${deleteId} THEN ${keepId} ELSE contact_id END,
          guardian_contact_id = CASE WHEN guardian_contact_id = ${deleteId} THEN ${keepId} ELSE guardian_contact_id END,
          father_contact_id = CASE WHEN father_contact_id = ${deleteId} THEN ${keepId} ELSE father_contact_id END,
          mother_contact_id = CASE WHEN mother_contact_id = ${deleteId} THEN ${keepId} ELSE mother_contact_id END
      WHERE workspace_subdomain = ${subdomain}
        AND (${deleteId} IN (contact_id, guardian_contact_id, father_contact_id, mother_contact_id))
    `);

    await tx.execute(sql`
      UPDATE ${faculty}
      SET contact_id = ${keepId}
      WHERE workspace_subdomain = ${subdomain}
        AND contact_id = ${deleteId}
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
  });
}
