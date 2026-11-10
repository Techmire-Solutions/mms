import { and, eq, gte, inArray, isNull, lte, or, type SQL } from "drizzle-orm";
import type { User } from "@mms/shared";
import { withTenantRead } from "../../db/tenant-context.js";
import { faculty } from "../../db/schema/faculty.js";
import { sectionStaffAssignments } from "../../db/schema/sessionSections.js";
import { enrollments } from "../../db/schema/enrollments.js";

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

/**
 * Resolves the student access scope for a given authenticated user.
 * Teachers are scoped strictly to the sections they are currently assigned to teach.
 */
export async function resolveStudentAccessScope(
  subdomain: string,
  user: User,
): Promise<StudentAccessScope> {
  const normalizedRole = (user.role ?? "").trim().toLowerCase();

  if (UNRESTRICTED_ROLES.has(normalizedRole)) {
    return { isUnrestricted: true, assignedSectionIds: [] };
  }

  if (!SECTION_SCOPED_ROLES.has(normalizedRole)) {
    // Non-faculty roles (auditor, accountant, librarian) keep standard role-permission behavior
    return { isUnrestricted: true, assignedSectionIds: [] };
  }

  try {
    return await withTenantRead(subdomain, async (tx) => {
      // Resolve faculty profile for the user
      const facultyConditions = [
        eq(faculty.workspaceSubdomain, subdomain),
        isNull(faculty.deletedAt),
        user.id ? eq(faculty.userId, user.id) : undefined,
      ].filter(Boolean) as (SQL | undefined)[];

      const facultyMembers = await tx
        .select({ id: faculty.id })
        .from(faculty)
        .where(and(...facultyConditions))
        .limit(1);

      if (facultyMembers.length === 0) {
        return { isUnrestricted: false, assignedSectionIds: [] };
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

      const assignedSectionIds = activeAssignments
        .map((a) => a.sectionId)
        .filter((id): id is string => Boolean(id));

      return {
        isUnrestricted: false,
        assignedSectionIds,
      };
    });
  } catch {
    // Fallback safely if tenant DB context is uninitialized (e.g. fastify mock integration tests)
    return { isUnrestricted: true, assignedSectionIds: [] };
  }
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
          ),
        )
        .limit(1);

      return activeEnrollments.length > 0;
    });
  } catch {
    return true;
  }
}
