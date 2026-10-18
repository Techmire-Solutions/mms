import { withTenant } from "../../../db/tenant-context.js";
import { canDeleteCollection, canWriteCollection } from "../../../services/rbacService.js";
import type { Faculty, User, facultyContract } from "@mms/shared";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { facultyUseCases } from "../../../faculty/use-cases/facultyUseCases.js";
import { validateFacultyDynamic } from "../../../services/facultyValidationService.js";
import { auditFaculty, sanitizeOneFacultyForUser } from "./facultyRouteHelpers.js";
import { isUniqueViolation } from "../../../lib/pgErrors.js";

export async function handleCreateFaculty({
  body,
  request,
}: ContractRouteArgs<(typeof facultyContract)["create"]>): Promise<
  ContractRouteResponse<(typeof facultyContract)["create"]>
> {
  const user = request.user as User;
  if (!canWriteCollection(user, "faculty")) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Insufficient permissions" },
    };
  }
  const lang = (request.headers["accept-language"] as string) || "en";
  const tenant = request.tenant?.id;
  if (!tenant) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Tenant context required" },
    };
  }
  try {
    await validateFacultyDynamic(tenant, body as Record<string, unknown>, lang);
  } catch (error) {
    return {
      status: 400 as const,
      body: {
        type: "validation_error",
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
  try {
    const result = await withTenant(
      String(tenant),
      () =>
        facultyUseCases.createFaculty(body, {
          canRestore: canDeleteCollection(user, "faculty"),
        }),
      { readOnly: false },
    );
    await auditFaculty(
      user,
      "faculty.create",
      `Created faculty member ${result.record.id}`,
      String(result.record.id),
    );
    const sanitized = await sanitizeOneFacultyForUser(result.record as Faculty, user);
    return result.restored
      ? {
          status: 200 as const,
          body: { success: true as const, faculty: sanitized, facultyMember: sanitized },
        }
      : {
          status: 201 as const,
          body: { success: true as const, faculty: sanitized, facultyMember: sanitized },
        };
  } catch (error: unknown) {
    request.log.error({ err: error }, "Failed to create faculty member");
    if (
      isUniqueViolation(error) ||
      (error instanceof Error && "statusCode" in error && error.statusCode === 409)
    ) {
      return {
        status: 409 as const,
        body: { type: "conflict", message: "Faculty ID, contact or employee ID already exists" },
      };
    }
    if ((error as { statusCode?: number }).statusCode === 400) {
      return {
        status: 400 as const,
        body: {
          type: "validation_error",
          message: error instanceof Error ? error.message : "Invalid request",
        },
      };
    }
    if ((error as { statusCode?: number }).statusCode === 403) {
      return {
        status: 403 as const,
        body: { type: "forbidden", message: error instanceof Error ? error.message : "Forbidden" },
      };
    }
    return {
      status: 500 as const,
      body: { type: "server_error", message: "Failed to create faculty member" },
    };
  }
}

export async function handleUpdateFaculty({
  params: { id },
  body,
  request,
}: ContractRouteArgs<(typeof facultyContract)["update"]>): Promise<
  ContractRouteResponse<(typeof facultyContract)["update"]>
> {
  const user = request.user as User;
  if (!canWriteCollection(user, "faculty")) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Insufficient permissions" },
    };
  }
  const payload = { ...(body as Record<string, unknown>), id };
  const lang = (request.headers["accept-language"] as string) || "en";
  const tenant = request.tenant?.id;
  if (!tenant) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Tenant context required" },
    };
  }
  try {
    await validateFacultyDynamic(tenant, payload, lang);
  } catch (error) {
    return {
      status: 400 as const,
      body: {
        type: "validation_error",
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
  try {
    const updated = await withTenant(
      String(tenant),
      () => facultyUseCases.updateFacultyById(id, body),
      { readOnly: false },
    );
    if (!updated) {
      return {
        status: 404 as const,
        body: { type: "not_found", message: "Faculty member not found" },
      };
    }
    await auditFaculty(user, "faculty.update", `Updated faculty member ${id}`, id);
    const sanitized = await sanitizeOneFacultyForUser(updated as Faculty, user);
    return {
      status: 200 as const,
      body: { success: true as const, faculty: sanitized, facultyMember: sanitized },
    };
  } catch (error: unknown) {
    request.log.error({ err: error }, "Failed to update faculty member");
    if ((error as { statusCode?: number }).statusCode === 400) {
      return {
        status: 400 as const,
        body: {
          type: "validation_error",
          message: error instanceof Error ? error.message : "Invalid request",
        },
      };
    }
    return {
      status: 500 as const,
      body: { type: "server_error", message: "Failed to update faculty member" },
    };
  }
}

export async function handleDeleteFaculty({
  params: { id },
  body,
  request,
}: ContractRouteArgs<(typeof facultyContract)["delete"]>): Promise<
  ContractRouteResponse<(typeof facultyContract)["delete"]>
> {
  const user = request.user as User;
  if (!canDeleteCollection(user, "faculty")) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Insufficient permissions" },
    };
  }
  const tenant = request.tenant?.id;
  if (!tenant) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Tenant context required" },
    };
  }
  try {
    const reason = body?.deletionReason;
    const reassignSubordinatesTo = body?.reassignSubordinatesTo;
    const deleted = await withTenant(
      String(tenant),
      () =>
        reassignSubordinatesTo
          ? facultyUseCases.deleteFacultyById(id, String(user.id), reason, reassignSubordinatesTo)
          : facultyUseCases.deleteFacultyById(id, String(user.id), reason),
      { readOnly: false },
    );
    if (!deleted)
      return {
        status: 404 as const,
        body: { type: "not_found", message: "Faculty member not found" },
      };
    const reasonNote = reason?.trim() ? ` — ${reason.trim()}` : "";
    await auditFaculty(
      user,
      "faculty.soft_delete",
      `Soft-deleted faculty member ${id}${reasonNote}`,
      id,
    );
    return { status: 200 as const, body: { success: true as const } };
  } catch (error: unknown) {
    request.log.error({ err: error }, "Failed to delete faculty member");
    if ((error as { statusCode?: number }).statusCode === 409) {
      return {
        status: 409 as const,
        body: {
          type: "conflict",
          message: error instanceof Error ? error.message : "Subordinate reassignment required",
        },
      };
    }
    return {
      status: 500 as const,
      body: { type: "server_error", message: "Failed to delete faculty member" },
    };
  }
}

export async function handleBulkStatus({
  body,
  request,
}: ContractRouteArgs<(typeof facultyContract)["bulkStatus"]>): Promise<
  ContractRouteResponse<(typeof facultyContract)["bulkStatus"]>
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
      () => facultyUseCases.bulkUpdateFacultyStatus(body.ids.map(String), body.status),
      { readOnly: false },
    );
    await auditFaculty(
      user,
      "faculty.bulk_status",
      `Updated status to ${body.status} for ${result.succeeded} faculty member(s); ${result.failed} failed`,
    );
    return { status: 200 as const, body: { success: true as const, ...result } };
  } catch {
    return {
      status: 500 as const,
      body: { type: "server_error", message: "Failed to bulk update faculty status" },
    };
  }
}

export async function handleBulkSpecialization({
  body,
  request,
}: ContractRouteArgs<(typeof facultyContract)["bulkSpecialization"]>): Promise<
  ContractRouteResponse<(typeof facultyContract)["bulkSpecialization"]>
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
      () =>
        facultyUseCases.bulkUpdateFacultySpecialization(body.ids.map(String), body.specialization),
      { readOnly: false },
    );
    await auditFaculty(
      user,
      "faculty.bulk_specialization",
      `Updated specialization to ${body.specialization} for ${result.succeeded} faculty member(s); ${result.failed} failed`,
    );
    return { status: 200 as const, body: { success: true as const, ...result } };
  } catch {
    return {
      status: 500 as const,
      body: { type: "server_error", message: "Failed to bulk update faculty specialization" },
    };
  }
}
