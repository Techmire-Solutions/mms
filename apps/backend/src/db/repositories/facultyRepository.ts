import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { type Faculty, type RepositoryListOptions } from "@mms/shared";
import { faculty, facultyEmployments } from "../schema.js";
import { withTenant, withTenantRead } from "../tenant-context.js";
import { buildTenantSoftDeleteConditions } from "../../services/genericRelationalService.js";
import {
  type FacultyInsert,
  FACULTY_PROJECTION_COLUMNS,
  facultyWriteValues,
  facultyRowToRecord,
  hydrateFacultyList,
  facultyUpdateSetValues,
  persistFacultyTx,
} from "./facultyRepositoryColumns.js";

export {
  type FacultyInsert,
  FACULTY_PROJECTION_COLUMNS,
  facultyWriteValues,
  facultyRowToRecord,
  hydrateFacultyList,
  facultyUpdateSetValues,
  persistFacultyTx,
};

export type ListFacultyOptions = RepositoryListOptions;

/**
 * Backup / snapshot dump of faculty for a workspace (soft-delete aware).
 * Cap: max 5000. Work directory UI must use `listFacultyPage` (paginated), never this.
 */
export async function listFacultyByWorkspace(
  tenant: string,
  options?: ListFacultyOptions,
): Promise<Faculty[]> {
  const subdomain = tenant.trim().toLowerCase();
  const deletedFilter = options?.deleted ?? (options?.includeDeleted ? "all" : "active");
  return withTenantRead(subdomain, async (tx) => {
    const conditions = buildTenantSoftDeleteConditions(faculty, subdomain, deletedFilter);

    const baseQuery = tx
      .select(FACULTY_PROJECTION_COLUMNS)
      .from(faculty)
      .where(and(...conditions))
      .orderBy(faculty.id);
    if (options?.offset) {
      baseQuery.offset(Math.max(0, options.offset));
    }
    const limit = Math.min(Math.max(1, options?.limit ?? 500), 5000);
    const rows = await baseQuery.limit(limit);
    return hydrateFacultyList(tx, subdomain, rows);
  });
}

export async function findFacultyById(tenant: string, id: string): Promise<Faculty | null> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select(FACULTY_PROJECTION_COLUMNS)
      .from(faculty)
      .where(and(eq(faculty.workspaceSubdomain, subdomain), eq(faculty.id, id)))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    const [hydrated] = await hydrateFacultyList(tx, subdomain, [row]);
    return hydrated ?? null;
  });
}

/** Finds the active faculty record linked to a contact, if one exists. */
export async function findFacultyByContactId(
  tenant: string,
  contactId: string,
): Promise<Faculty | null> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select(FACULTY_PROJECTION_COLUMNS)
      .from(faculty)
      .innerJoin(
        facultyEmployments,
        and(
          eq(faculty.workspaceSubdomain, facultyEmployments.workspaceSubdomain),
          eq(faculty.employmentId, facultyEmployments.id),
          isNull(facultyEmployments.deletedAt),
        ),
      )
      .where(
        and(
          eq(faculty.workspaceSubdomain, subdomain),
          eq(facultyEmployments.contactId, contactId),
          isNull(faculty.deletedAt),
        ),
      )
      .limit(1);
    if (!rows[0]) return null;
    const [hydrated] = await hydrateFacultyList(tx, subdomain, [rows[0]]);
    return hydrated ?? null;
  });
}

export async function findFacultyByIds(tenant: string, ids: string[]): Promise<Faculty[]> {
  if (ids.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select(FACULTY_PROJECTION_COLUMNS)
      .from(faculty)
      .where(and(eq(faculty.workspaceSubdomain, subdomain), inArray(faculty.id, ids)));
    return hydrateFacultyList(tx, subdomain, rows);
  });
}

export async function saveFaculty(
  tenant: string,
  member: Faculty,
  options?: { createOnly?: boolean },
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await persistFacultyTx(tx, subdomain, member, options);
  });
  const { syncFacultyLinkedUserRole } =
    await import("../../faculty/use-cases/facultyLinkedUserRoleSync.js");
  await syncFacultyLinkedUserRole(subdomain, member);
}

export async function bulkSaveFaculty(tenant: string, items: Faculty[]): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  if (items.length === 0) return;
  await withTenant(subdomain, async (tx) => {
    for (const item of items) {
      await persistFacultyTx(tx, subdomain, item);
    }
  });
  const { syncFacultyLinkedUserRole } =
    await import("../../faculty/use-cases/facultyLinkedUserRoleSync.js");
  for (const item of items) {
    await syncFacultyLinkedUserRole(subdomain, item);
  }
}

export async function replaceFacultyForWorkspace(tenant: string, items: Faculty[]): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  // Role sync intentionally omitted: full workspace replace is a rare admin wipe path.
  await withTenant(subdomain, async (tx) => {
    await tx.delete(faculty).where(eq(faculty.workspaceSubdomain, subdomain));
    for (const item of items) {
      await persistFacultyTx(tx, subdomain, item, { createOnly: true });
    }
  });
}

export async function countFacultyByWorkspace(
  tenant: string,
  options?: ListFacultyOptions,
): Promise<number> {
  const subdomain = tenant.trim().toLowerCase();
  const deletedFilter = options?.deleted ?? (options?.includeDeleted ? "all" : "active");
  return withTenantRead(subdomain, async (tx) => {
    const conditions = buildTenantSoftDeleteConditions(faculty, subdomain, deletedFilter);

    const rows = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(faculty)
      .where(and(...conditions));
    return Number(rows[0]?.count ?? 0);
  });
}

export {
  countSubordinates,
  countSubordinatesBatch,
  findSubordinates,
  reassignSubordinates,
  findAncestorChain,
} from "./facultyRepositorySubordinates.js";
