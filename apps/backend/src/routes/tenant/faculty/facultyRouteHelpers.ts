import {
  type Faculty,
  type User,
  FACULTY_MODULE_MANIFEST,
  roleHasPermission,
  type facultyContract,
} from "@mms/shared";
import { createCollectionAuditHelper } from "../../../lib/createCollectionAuditHelper.js";
import { facultyUseCases } from "../../../faculty/use-cases/facultyUseCases.js";
import { previewNextEmployeeId } from "../../../faculty/use-cases/facultyEmployeeIdService.js";
import { withTenant } from "../../../db/tenant-context.js";
import { getRequestTenant } from "../../../lib/tenantContext.js";
import { canReadCollection, canWriteCollection } from "../../../services/rbacService.js";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";

/** Thin Faculty audit helper — same shape as Contacts `auditContact`. */
export const auditFaculty = createCollectionAuditHelper("faculty", { subjectScoped: true });

/** Strips faculty properties the viewer role cannot read (field-config + viewer role). */
export async function sanitizeFacultyForUser(
  facultyList: Faculty[],
  user: User,
): Promise<Faculty[]> {
  return facultyUseCases.sanitizeFacultyListForViewer(facultyList, user.role);
}

export async function sanitizeOneFacultyForUser(
  facultyMember: Faculty,
  user: User,
): Promise<Faculty> {
  return facultyUseCases.sanitizeFacultyForViewer(facultyMember, user.role);
}

export async function handleDuplicateCheck({
  body,
  request,
}: ContractRouteArgs<(typeof facultyContract)["duplicateCheck"]>): Promise<
  ContractRouteResponse<(typeof facultyContract)["duplicateCheck"]>
> {
  const user = request.user as User;
  if (!canWriteCollection(user, "faculty")) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Insufficient permissions" },
    };
  }
  try {
    const result = await withTenant(
      String(request.tenant?.id),
      () => facultyUseCases.checkFacultyRegistrationDuplicate(body),
      { readOnly: true },
    );
    return { status: 200 as const, body: result };
  } catch {
    return {
      status: 500 as const,
      body: { type: "server_error", message: "Failed to check duplicate" },
    };
  }
}

export async function handleNextEmployeeId({
  query,
  request,
}: ContractRouteArgs<(typeof facultyContract)["nextEmployeeId"]>): Promise<
  ContractRouteResponse<(typeof facultyContract)["nextEmployeeId"]>
> {
  const user = request.user as User;
  if (!canReadCollection(user, "faculty")) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Insufficient permissions" },
    };
  }
  const tenant = getRequestTenant() ?? user.workspaceSubdomain;
  if (!tenant) {
    return {
      status: 500 as const,
      body: { type: "server_error", message: "Tenant context required" },
    };
  }
  try {
    const preview = await previewNextEmployeeId(tenant);
    if (preview.nextEmployeeId) {
      return { status: 200 as const, body: { employeeId: preview.nextEmployeeId } };
    }
  } catch (error) {
    // Missing faculty_setup_config (or other preview errors): do not wrap the
    // fallback in an outer withTenant — a failed nested SELECT would abort it.
    request.log?.warn?.(
      { err: error, tenant },
      "faculty next-employee-id preview failed; using prefs fallback",
    );
  }
  try {
    // Repo helpers open their own withTenantRead transactions.
    const employeeId = await facultyUseCases.computeNextFacultyEmployeeIdForSettings({
      idPrefix: query.prefix,
      idTemplate: query.template,
      idDigits: query.digits,
      idStartSeq: query.startSeq,
      idRestartAnnually: query.restartAnnually,
    });
    return { status: 200 as const, body: { employeeId } };
  } catch (error) {
    request.log?.error?.({ err: error, tenant }, "Failed to compute next employee ID");
    return {
      status: 500 as const,
      body: { type: "server_error", message: "Failed to compute next employee ID" },
    };
  }
}

export async function handleMigrateEmployeeIds({
  request,
}: ContractRouteArgs<(typeof facultyContract)["migrateEmployeeIds"]>): Promise<
  ContractRouteResponse<(typeof facultyContract)["migrateEmployeeIds"]>
> {
  const user = request.user as User;
  if (
    !canWriteCollection(user, "faculty") ||
    !roleHasPermission(user.role, FACULTY_MODULE_MANIFEST.permissions.setupWrite)
  ) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Insufficient permissions" },
    };
  }
  try {
    const result = await withTenant(
      String(request.tenant?.id),
      () => facultyUseCases.migrateFacultyMissingEmployeeIds(),
      { readOnly: false },
    );
    return { status: 200 as const, body: { success: true as const, ...result } };
  } catch {
    return {
      status: 500 as const,
      body: { type: "server_error", message: "Failed to migrate employee IDs" },
    };
  }
}
