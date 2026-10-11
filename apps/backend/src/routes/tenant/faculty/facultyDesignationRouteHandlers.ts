import { isQueryFlagTrue, type facultyContract } from "@mms/shared";
import { canDeleteCollection } from "../../../services/rbacService.js";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import {
  listFacultyDesignationAssignments,
  listFacultyDesignations,
  saveFacultyDesignation,
  softDeleteFacultyDesignation,
} from "../../../db/repositories/facultyDesignationRepository.js";
import { restoreFacultyDesignation } from "../../../db/repositories/facultyCatalogTrashRepository.js";
import { auditFaculty } from "./facultyRouteHelpers.js";
import {
  authorizeCatalogRoute,
  canArchiveFacultySetup,
  canManageFacultySetup,
  canReadFacultyCatalog,
  isCatalogConflict,
} from "./facultyCatalogRouteAuth.js";

export async function handleListDesignations({
  query,
  request,
}: ContractRouteArgs<(typeof facultyContract)["listDesignations"]>): Promise<
  ContractRouteResponse<(typeof facultyContract)["listDesignations"]>
> {
  const auth = authorizeCatalogRoute(request, canReadFacultyCatalog);
  if ("status" in auth) return auth;
  const includeDeleted = isQueryFlagTrue(query?.includeDeleted);
  if (includeDeleted && !canDeleteCollection(auth.user, "faculty")) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Insufficient permissions" },
    };
  }
  try {
    const designations = await listFacultyDesignations(auth.tenantId, { includeDeleted });
    return { status: 200 as const, body: { designations } };
  } catch {
    return {
      status: 500 as const,
      body: { type: "server_error", message: "Failed to list Faculty designations" },
    };
  }
}

export async function handleRestoreDesignation({
  params: { id },
  request,
}: ContractRouteArgs<(typeof facultyContract)["restoreDesignation"]>): Promise<
  ContractRouteResponse<(typeof facultyContract)["restoreDesignation"]>
> {
  const auth = authorizeCatalogRoute(request, canArchiveFacultySetup);
  if ("status" in auth) return auth;
  try {
    const designation = await restoreFacultyDesignation(auth.tenantId, id, auth.user.id);
    if (!designation) {
      return {
        status: 404 as const,
        body: { type: "not_found", message: "Designation not found in trash" },
      };
    }
    return { status: 200 as const, body: { designation } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not restore designation";
    if (isCatalogConflict(error))
      return { status: 409 as const, body: { type: "conflict", message } };
    return { status: 400 as const, body: { type: "validation_error", message } };
  }
}

export async function handleSaveDesignation({
  params: { id },
  body,
  request,
}: ContractRouteArgs<(typeof facultyContract)["saveDesignation"]>): Promise<
  ContractRouteResponse<(typeof facultyContract)["saveDesignation"]>
> {
  const auth = authorizeCatalogRoute(request, canManageFacultySetup);
  if ("status" in auth) return auth;
  try {
    const designation = await saveFacultyDesignation(auth.tenantId, {
      ...body,
      id,
      updatedBy: auth.user.id,
    });
    await auditFaculty(
      auth.user,
      "faculty.designation.save",
      `Saved faculty designation ${designation.name} (${designation.departmentName ?? designation.departmentId})`,
      designation.id,
    );
    return { status: 200 as const, body: { designation } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid designation";
    if (isCatalogConflict(error))
      return { status: 409 as const, body: { type: "conflict", message } };
    return { status: 400 as const, body: { type: "validation_error", message } };
  }
}

export async function handleListDesignationHistory({
  params: { facultyId },
  request,
}: ContractRouteArgs<(typeof facultyContract)["listDesignationHistory"]>): Promise<
  ContractRouteResponse<(typeof facultyContract)["listDesignationHistory"]>
> {
  const auth = authorizeCatalogRoute(request, canReadFacultyCatalog);
  if ("status" in auth) return auth;
  try {
    const assignments = await listFacultyDesignationAssignments(auth.tenantId, facultyId);
    return { status: 200 as const, body: { assignments } };
  } catch {
    return {
      status: 500 as const,
      body: { type: "server_error", message: "Failed to load designation history" },
    };
  }
}

export async function handleDeleteDesignation({
  params: { id },
  request,
}: ContractRouteArgs<(typeof facultyContract)["deleteDesignation"]>): Promise<
  ContractRouteResponse<(typeof facultyContract)["deleteDesignation"]>
> {
  const auth = authorizeCatalogRoute(request, canArchiveFacultySetup);
  if ("status" in auth) return auth;
  try {
    await softDeleteFacultyDesignation(auth.tenantId, id, auth.user.id);
    await auditFaculty(
      auth.user,
      "faculty.designation.delete",
      `Deleted faculty designation ${id}`,
      id,
    );
    return { status: 200 as const, body: { success: true as const } };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete designation";
    if (isCatalogConflict(error))
      return { status: 409 as const, body: { type: "conflict", message } };
    if (message.includes("not found"))
      return { status: 404 as const, body: { type: "not_found", message } };
    return { status: 400 as const, body: { type: "validation_error", message } };
  }
}
