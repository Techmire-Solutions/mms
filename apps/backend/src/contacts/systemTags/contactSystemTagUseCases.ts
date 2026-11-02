import { and, eq, inArray, sql } from "drizzle-orm";
import {
  contactTags,
  contacts,
  faculty,
  facultyAssignments,
  facultyEmployDesignations,
  facultyEmployments,
} from "../../db/schema.js";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { withTenant } from "../../db/tenant-context.js";
import { reconcileContactSystemTags } from "./contactSystemTagReconcile.js";

export { reconcileContactSystemTags } from "./contactSystemTagReconcile.js";

/** Faculty-assignment/catalog callers know a faculty id, not the linked contact. */
export async function reconcileFacultyContactsByFacultyIds(
  tenant: string,
  facultyIds: string[],
  options?: { actorId?: string },
): Promise<number> {
  const subdomain = tenant.trim().toLowerCase();
  const ids = facultyIds.map((id) => String(id).trim()).filter(Boolean);
  if (ids.length === 0) return 0;
  const rows = await withTenant(subdomain, async (tx) => {
    if (typeof (tx as unknown as { select?: unknown }).select !== "function") {
      return [] as Array<{ contactId: string }>;
    }
    return tx
      .select({ contactId: facultyEmployments.contactId })
      .from(facultyEmployments)
      .innerJoin(
        faculty,
        and(
          eq(faculty.workspaceSubdomain, subdomain),
          eq(faculty.employmentId, facultyEmployments.id),
        ),
      )
      .where(and(eq(facultyEmployments.workspaceSubdomain, subdomain), inArray(faculty.id, ids)));
  });
  return reconcileContactSystemTags(
    tenant,
    rows.map((row) => row.contactId),
    options,
  );
}

/** Designation rename/status/delete affects every contact holding that role key. */
export async function reconcileDesignationContacts(
  tenant: string,
  designationId: string,
  options?: { actorId?: string },
): Promise<number> {
  const subdomain = tenant.trim().toLowerCase();
  const rows = await withTenant(subdomain, async (tx) => {
    if (typeof (tx as unknown as { select?: unknown }).select !== "function") {
      return [] as Array<{ contactId: string }>;
    }
    // Derive affected contacts from role tables (not existing tag rows), so a
    // missing tag is repaired by the rename/delete reconcile.
    const tenureRows = await tx
      .select({ contactId: facultyEmployments.contactId })
      .from(facultyEmployments)
      .innerJoin(
        facultyEmployDesignations,
        and(
          eq(facultyEmployDesignations.workspaceSubdomain, subdomain),
          eq(facultyEmployDesignations.employmentId, facultyEmployments.id),
        ),
      )
      .where(
        and(
          eq(facultyEmployments.workspaceSubdomain, subdomain),
          eq(facultyEmployDesignations.designationId, designationId),
        ),
      );
    const assignmentRows = await tx
      .select({ contactId: facultyEmployments.contactId })
      .from(facultyEmployments)
      .innerJoin(
        faculty,
        and(
          eq(faculty.workspaceSubdomain, subdomain),
          eq(faculty.employmentId, facultyEmployments.id),
        ),
      )
      .innerJoin(
        facultyAssignments,
        and(
          eq(facultyAssignments.workspaceSubdomain, subdomain),
          eq(facultyAssignments.facultyId, faculty.id),
        ),
      )
      .where(
        and(
          eq(facultyEmployments.workspaceSubdomain, subdomain),
          eq(facultyAssignments.designationId, designationId),
        ),
      );
    return [...tenureRows, ...assignmentRows];
  });
  return reconcileContactSystemTags(
    tenant,
    rows.map((row) => row.contactId),
    options,
  );
}

/** Contact merge is not a role end: drop the merged-away contact's system rows. */
export async function removeSystemTagsForContacts(
  tenant: string,
  contactIds: Array<string | number>,
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  const ids = contactIds.map(String).filter(Boolean);
  if (ids.length === 0) return;
  await withTenant(subdomain, async (tx) => {
    if (typeof (tx as unknown as { delete?: unknown }).delete !== "function") return;
    await tx
      .delete(contactTags)
      .where(
        and(
          eq(contactTags.workspaceSubdomain, subdomain),
          inArray(contactTags.contactId, ids),
          sql`${contactTags.systemKey} is not null`,
        ),
      );
  });
}

/** Full sweep — backfill verification and a safety net for missed hooks. */
export async function reconcileAllContactSystemTags(options?: {
  actorId?: string;
}): Promise<number> {
  const tenant = getRequestTenant();
  if (!tenant) return 0;
  const rows = await withTenant(tenant.trim().toLowerCase(), (tx) =>
    tx
      .select({ id: contacts.id })
      .from(contacts)
      .where(eq(contacts.workspaceSubdomain, tenant.trim().toLowerCase())),
  );
  return reconcileContactSystemTags(
    tenant,
    rows.map((row) => row.id),
    options,
  );
}
