import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { type Faculty, type RepositoryListOptions } from "@mms/shared";
import { faculty, facultyEmployments } from "../schema.js";
import { withTenant, withTenantRead } from "../tenant-context.js";
import { naiveTimestamp } from "../../lib/dbDate.js";
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

/**
 * Tombstone probe for the session guard. Looks the faculty profile up by its
 * linked **tenant user id** (`faculty.user_id`), not by the faculty primary
 * key, and skips hydration so an unreadable contact cannot hide a deleted
 * profile. Backed by `faculty_workspace_user_idx`.
 */
export async function isFacultyDeletedByUserId(tenant: string, userId: string): Promise<boolean> {
  const subdomain = tenant.trim().toLowerCase();
  if (!subdomain || !userId) return false;
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({ deletedAt: faculty.deletedAt })
      .from(faculty)
      .where(and(eq(faculty.workspaceSubdomain, subdomain), eq(faculty.userId, userId)))
      .limit(1);
    return Boolean(rows[0]?.deletedAt);
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
  const { syncFacultyLinkedUserRole } =
    await import("../../faculty/use-cases/facultyLinkedUserRoleSync.js");
  // Role sync runs inside the faculty transaction so a rejected privilege
  // change (FacultyRoleSyncForbiddenError) rolls the faculty write back too.
  await withTenant(subdomain, async (tx) => {
    await persistFacultyTx(tx, subdomain, member, options);
    await syncFacultyLinkedUserRole(subdomain, member);
  });
}

/**
 * Conditional save for optimistic concurrency (`mms-api-interface` §6).
 *
 * The `updated_at` predicate is checked under `FOR UPDATE` inside the same
 * transaction that persists the row, so a writer that committed after the
 * caller's read cannot be silently overwritten. A stale token returns false
 * (caller maps it to 409).
 */
export async function saveFacultyIfVersionMatches(
  tenant: string,
  member: Faculty,
  expectedUpdatedAt: string,
): Promise<boolean> {
  const subdomain = tenant.trim().toLowerCase();
  const expected = new Date(expectedUpdatedAt);
  if (Number.isNaN(expected.getTime())) return false;
  const naiveExpected = naiveTimestamp(expected);
  const { syncFacultyLinkedUserRole } =
    await import("../../faculty/use-cases/facultyLinkedUserRoleSync.js");
  let saved = false;
  await withTenant(subdomain, async (tx) => {
    const rows = await tx
      .select({ id: faculty.id })
      .from(faculty)
      .where(
        and(
          eq(faculty.workspaceSubdomain, subdomain),
          eq(faculty.id, String(member.id)),
          isNull(faculty.deletedAt),
          or(
            sql`date_trunc('milliseconds', ${faculty.updatedAt}) = ${naiveExpected}::timestamp`,
            sql`date_trunc('milliseconds', ${faculty.updatedAt}) = ${expected}::timestamptz`,
          ),
        ),
      )
      .for("update")
      .limit(1);
    if (rows.length === 0) return;
    await persistFacultyTx(tx, subdomain, member);
    await syncFacultyLinkedUserRole(subdomain, member);
    saved = true;
  });
  return saved;
}

export async function bulkSaveFaculty(tenant: string, items: Faculty[]): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  if (items.length === 0) return;
  const { syncFacultyLinkedUserRole } =
    await import("../../faculty/use-cases/facultyLinkedUserRoleSync.js");
  await withTenant(subdomain, async (tx) => {
    for (const item of items) {
      await persistFacultyTx(tx, subdomain, item);
      await syncFacultyLinkedUserRole(subdomain, item);
    }
  });
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
