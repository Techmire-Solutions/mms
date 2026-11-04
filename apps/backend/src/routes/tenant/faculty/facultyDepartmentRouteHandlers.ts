import { isQueryFlagTrue, type facultyContract } from "@mms/shared";
import { canDeleteCollection } from "../../../services/rbacService.js";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import {
  findFacultyDepartmentById,
  listFacultyDepartments,
  restoreFacultyDepartment,
  saveFacultyDepartment,
  softDeleteFacultyDepartment,
} from "../../../faculty/use-cases/facultyCatalogUseCases.js";
import { broadcastCollection } from "../../../lib/livePush.js";
import {
  authorizeCatalogRoute,
  canArchiveFacultySetup,
  canManageFacultySetup,
  canReadFacultyCatalog,
  isCatalogConflict,
} from "./facultyCatalogRouteAuth.js";
import { catalogErrorResponse } from "./facultyCatalogErrorResponse.js";

const DUPLICATE_NAME = "A department with this name already exists";

export async function handleListDepartments({
  query,
  request,
}: ContractRouteArgs<(typeof facultyContract)["listDepartments"]>): Promise<
  ContractRouteResponse<(typeof facultyContract)["listDepartments"]>
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
    const departments = await listFacultyDepartments(auth.tenantId, { includeDeleted });
    return { status: 200 as const, body: { departments } };
  } catch (error: unknown) {
    request.log.error({ err: error }, "Failed to list faculty departments");
    return {
      status: 500 as const,
      body: { type: "server_error", message: "Failed to list faculty departments" },
    };
  }
}

export async function handleRestoreDepartment({
  params: { id },
  request,
}: ContractRouteArgs<(typeof facultyContract)["restoreDepartment"]>): Promise<
  ContractRouteResponse<(typeof facultyContract)["restoreDepartment"]>
> {
  const auth = authorizeCatalogRoute(request, canArchiveFacultySetup);
  if ("status" in auth) return auth;
  try {
    const department = await restoreFacultyDepartment(auth.tenantId, id, auth.user.id);
    if (!department) {
      return {
        status: 404 as const,
        body: { type: "not_found", message: "Department not found in trash" },
      };
    }
    await broadcastCollection("faculty");
    return { status: 200 as const, body: { department } };
  } catch (error) {
    return catalogErrorResponse(
      error,
      request,
      "Failed to restore faculty department",
      "Could not restore department",
    );
  }
}

export async function handleSaveDepartment({
  params: { id },
  body,
  request,
}: ContractRouteArgs<(typeof facultyContract)["saveDepartment"]>): Promise<
  ContractRouteResponse<(typeof facultyContract)["saveDepartment"]>
> {
  const auth = authorizeCatalogRoute(request, canManageFacultySetup);
  if ("status" in auth) return auth;
  try {
    const department = await saveFacultyDepartment(auth.tenantId, {
      id,
      name: body.name,
      description: body.description ?? null,
      status: body.status,
      updatedBy: auth.user.id,
    });
    await broadcastCollection("faculty");
    return { status: 200 as const, body: { department } };
  } catch (error) {
    if (isCatalogConflict(error))
      return { status: 409 as const, body: { type: "conflict", message: DUPLICATE_NAME } };
    return catalogErrorResponse(
      error,
      request,
      "Failed to save faculty department",
      "Invalid department",
    );
  }
}

export async function handleDeleteDepartment({
  params: { id },
  request,
}: ContractRouteArgs<(typeof facultyContract)["deleteDepartment"]>): Promise<
  ContractRouteResponse<(typeof facultyContract)["deleteDepartment"]>
> {
  const auth = authorizeCatalogRoute(request, canArchiveFacultySetup);
  if ("status" in auth) return auth;
  try {
    const existing = await findFacultyDepartmentById(auth.tenantId, id);
    if (!existing) {
      return { status: 404 as const, body: { type: "not_found", message: "Department not found" } };
    }
    await softDeleteFacultyDepartment(auth.tenantId, id, auth.user.id, "User deleted");
    await broadcastCollection("faculty");
    return { status: 200 as const, body: { success: true as const } };
  } catch (error) {
    if (isCatalogConflict(error)) {
      return {
        status: 409 as const,
        body: {
          type: "conflict",
          message: "Cannot delete department: active designations or assignments reference it",
        },
      };
    }
    return catalogErrorResponse(
      error,
      request,
      "Failed to delete faculty department",
      "Failed to delete department",
    );
  }
}
