import { and, eq, gte, inArray, isNull, lte, notInArray, or } from "drizzle-orm";
import { SEAT_RELEASED_ENROLLMENT_STATUSES, dedupeTrimmedIds, type User } from "@mms/contracts";
import { withTenantRead } from "@mms/db/context";
import { faculty } from "@mms/db/schema/faculty";
import { sectionStaffAssignments } from "@mms/db/schema/sessionSections";
import { enrollments } from "@mms/db/schema/enrollments";

export interface StudentAccessScope {
  /** If true, the user has global tenant-wide student directory visibility. */
  isUnrestricted: boolean;
  /** If not unrestricted, list of section IDs the user is currently authorized to view. */
  assignedSectionIds: string[];
}

/** Administrative roles that possess institution-wide directory visibility. */
const UNRESTRICTED_ROLES = new Set([
  "super_admin",
  "admin",
  "principal",
  "registrar",
  "super_user",
]);

/** Roles subjected to section roster scoping. */
const SECTION_SCOPED_ROLES = new Set(["teacher", "assistant_teacher", "staff"]);

/** Statuses that no longer hold a seat, and therefore no longer grant roster visibility. */
const INACTIVE_ENROLLMENT_STATUSES = [...SEAT_RELEASED_ENROLLMENT_STATUSES];

/**
 * Resolves the student access scope for a given authenticated user.
 * Teachers are scoped strictly to the sections they are currently assigned to teach.
 *
 * Authorization is fail-closed: if the faculty/assignment lookup cannot be
 * completed, a section-scoped role gets an empty scope (no roster visibility)
 * rather than a tenant-wide one.
 */
export async function resolveStudentAccessScope(
  subdomain: string,
  user: User,
): Promise<StudentAccessScope> {
  const normalizedRole = (user.role ?? "").trim().toLowerCase();

  if (UNRESTRICTED_ROLES.has(normalizedRole)) {
    return { isUnrestricted: true, assignedSectionIds: [] };
  }

  // Resolve the faculty profile for ANY non-administrative role, so a tenant-created
  // role (e.g. "class_teacher") with section assignments is scoped exactly like the
  // built-in `teacher` role instead of silently gaining tenant-wide visibility.
  let profile: { found: boolean; sections: string[] };
  try {
    profile = await lookupFacultySections(subdomain, user);
  } catch {
    // Fail closed: an authorization lookup failure must never widen a non-admin
    // role to the tenant-wide directory. (Route tests inject the scope port.)
    return { isUnrestricted: false, assignedSectionIds: [] };
  }

  if (profile.found) {
    return { isUnrestricted: false, assignedSectionIds: profile.sections };
  }

  // No faculty profile: built-in scoped roles stay scoped-empty; every other role
  // (auditor, accountant, librarian, custom non-faculty roles) keeps unrestricted.
  return SECTION_SCOPED_ROLES.has(normalizedRole)
    ? { isUnrestricted: false, assignedSectionIds: [] }
    : { isUnrestricted: true, assignedSectionIds: [] };
}

/**
 * Returns the faculty profile's currently-active section assignments for a user,
 * or `{ found: false }` when the user has no faculty profile (or no identity).
 */
async function lookupFacultySections(
  subdomain: string,
  user: User,
): Promise<{ found: boolean; sections: string[] }> {
  if (!user.id) return { found: false, sections: [] };

  return withTenantRead(subdomain, async (tx) => {
    const facultyMembers = await tx
      .select({ id: faculty.id })
      .from(faculty)
      .where(
        and(
          eq(faculty.workspaceSubdomain, subdomain),
          isNull(faculty.deletedAt),
          eq(faculty.userId, user.id),
        ),
      )
      .limit(1);

    if (facultyMembers.length === 0) {
      return { found: false, sections: [] };
    }

    const facultyId = facultyMembers[0].id;
    const todayStr = new Date().toISOString().slice(0, 10);

    const activeAssignments = await tx
      .select({ sectionId: sectionStaffAssignments.sectionId })
      .from(sectionStaffAssignments)
      .where(
        and(
          eq(sectionStaffAssignments.workspaceSubdomain, subdomain),
          isNull(sectionStaffAssignments.deletedAt),
          eq(sectionStaffAssignments.facultyId, facultyId),
          lte(sectionStaffAssignments.startOn, todayStr),
          or(isNull(sectionStaffAssignments.endOn), gte(sectionStaffAssignments.endOn, todayStr)),
        ),
      );

    const sections = activeAssignments
      .map((a) => a.sectionId)
      .filter((id): id is string => Boolean(id));

    return { found: true, sections };
  });
}

/**
 * Checks if a target student is currently enrolled in any of the authorized sections.
 */
export async function isStudentInAssignedSections(
  subdomain: string,
  studentId: string,
  assignedSectionIds: string[],
): Promise<boolean> {
  if (assignedSectionIds.length === 0) return false;

  try {
    return await withTenantRead(subdomain, async (tx) => {
      const activeEnrollments = await tx
        .select({ id: enrollments.id })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.workspaceSubdomain, subdomain),
            eq(enrollments.studentId, studentId),
            isNull(enrollments.deletedAt),
            inArray(enrollments.sectionId, assignedSectionIds),
            notInArray(enrollments.status, INACTIVE_ENROLLMENT_STATUSES),
          ),
        )
        .limit(1);

      return activeEnrollments.length > 0;
    });
  } catch {
    // Fail closed: an unverifiable membership must deny access.
    return false;
  }
}

/**
 * Batch membership filter used by export/bulk paths (single query, no N+1).
 * Returns the subset of `studentIds` that are currently enrolled in an assigned
 * section; any lookup failure returns an empty set (fail closed).
 */
export async function filterStudentIdsInAssignedSections(
  subdomain: string,
  studentIds: string[],
  assignedSectionIds: string[],
): Promise<string[]> {
  const ids = dedupeTrimmedIds(studentIds);
  if (ids.length === 0 || assignedSectionIds.length === 0) return [];

  try {
    return await withTenantRead(subdomain, async (tx) => {
      const rows = await tx
        .selectDistinct({ studentId: enrollments.studentId })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.workspaceSubdomain, subdomain),
            inArray(enrollments.studentId, ids),
            isNull(enrollments.deletedAt),
            inArray(enrollments.sectionId, assignedSectionIds),
            notInArray(enrollments.status, INACTIVE_ENROLLMENT_STATUSES),
          ),
        );
      return rows.map((row) => String(row.studentId));
    });
  } catch {
    return [];
  }
}
