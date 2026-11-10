/**
 * Instructor award scope — enforces WHO an instructor may award.
 *
 * RBAC is collection-wide (`hasanat.write` lets a teacher write any card in the tenant), and the
 * module preference `awardScope` narrows that to the classes the instructor actually teaches:
 * `tenant_users → faculty.user_id → session_classes.faculty_id → enrollments`.
 *
 * Admins (holders of `hasanat.delete`, i.e. the destructive/award-reversal right) always bypass the
 * scope, so a principal can still issue on behalf of any class. Background jobs carry no `User`
 * object, so `resolveAwardScopeBypass` resolves the enqueuer's role server-side.
 */

import { roleHasPermission, type HasanatAwardScope } from "@mms/shared";
import { HttpDomainError } from "../../lib/httpErrors.js";
import type { HasanatRepository } from "../repository/hasanatRepository.js";

export interface AwardScopeCheck {
  tenant: string;
  repo: HasanatRepository;
  actorUserId: string;
  /** `true` for admins (`hasanat.delete` holders). */
  bypass: boolean;
  /** Workspace preference; `tenant` disables the check entirely. */
  awardScope: HasanatAwardScope;
  classIds?: readonly (string | null | undefined)[];
  studentIds?: readonly (string | null | undefined)[];
}

function forbidden(message: string, details: Record<string, unknown>): HttpDomainError {
  return new HttpDomainError(403, "award_out_of_scope", message, { details });
}

/** Throws 403 `award_out_of_scope` unless every recipient is inside the actor's teaching scope. */
export async function assertAwardScope(check: AwardScopeCheck): Promise<void> {
  if (check.awardScope !== "assigned_classes" || check.bypass) return;

  const classIds = Array.from(
    new Set((check.classIds ?? []).map((id) => id?.trim()).filter(Boolean)),
  ) as string[];
  const studentIds = Array.from(
    new Set((check.studentIds ?? []).map((id) => id?.trim()).filter(Boolean)),
  ) as string[];
  if (classIds.length === 0 && studentIds.length === 0) return;

  const facultyId = await check.repo.findFacultyIdForUser(check.tenant, check.actorUserId);
  if (!facultyId) {
    throw forbidden(
      "Your account is not linked to a staff record, so it cannot award inside a class scope.",
      { reason: "no_faculty_record" },
    );
  }

  if (classIds.length > 0) {
    const taught = new Set(await check.repo.listClassIdsTaughtByFaculty(check.tenant, facultyId));
    const outside = classIds.filter((id) => !taught.has(id));
    if (outside.length > 0) {
      throw forbidden("You can only award cards to the classes you teach.", {
        classIds: outside,
      });
    }
  }

  if (studentIds.length > 0) {
    const allowed = new Set(
      await check.repo.filterStudentsInFacultyClasses(check.tenant, facultyId, studentIds),
    );
    const outside = studentIds.filter((id) => !allowed.has(id));
    if (outside.length > 0) {
      throw forbidden("You can only award cards to students enrolled in the classes you teach.", {
        studentIds: outside,
      });
    }
  }
}

/** Job-path bypass: the enqueuing user must hold the award-reversal right server-side. */
export async function resolveAwardScopeBypass(
  tenant: string,
  userId: string,
  repo: HasanatRepository,
): Promise<boolean> {
  const role = await repo.findTenantUserRole(tenant, userId);
  return role ? roleHasPermission(role, "hasanat.delete") : false;
}
