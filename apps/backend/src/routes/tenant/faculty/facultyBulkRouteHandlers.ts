import { withTenant } from "../../../db/tenant-context.js";
import { canWriteCollection } from "../../../services/rbacService.js";
import type { User, facultyContract } from "@mms/shared";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { facultyUseCases } from "../../../faculty/use-cases/facultyUseCases.js";
import { auditFaculty } from "./facultyRouteHelpers.js";

/** Bulk status / specialization updates for the faculty directory. */
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
  const tenantId = request.tenant?.id;
  if (!tenantId) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Tenant context required" },
    };
  }
  try {
    const result = await withTenant(
      String(tenantId),
      () => facultyUseCases.bulkUpdateFacultyStatus(body.ids.map(String), body.status, user.id),
      { readOnly: false },
    );
    await auditFaculty(
      user,
      "faculty.bulk_status",
      `Updated status to ${body.status} for ${result.succeeded} faculty member(s); ${result.failed} failed`,
    );
    return { status: 200 as const, body: { success: true as const, ...result } };
  } catch (error: unknown) {
    request.log.error({ err: error }, "Failed to bulk update faculty status");
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
  const tenantId = request.tenant?.id;
  if (!tenantId) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Tenant context required" },
    };
  }
  try {
    const result = await withTenant(
      String(tenantId),
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
  } catch (error: unknown) {
    request.log.error({ err: error }, "Failed to bulk update faculty specialization");
    return {
      status: 500 as const,
      body: { type: "server_error", message: "Failed to bulk update faculty specialization" },
    };
  }
}
