import { type attendanceContract, type User, ATTENDANCE_MODULE_MANIFEST } from "@mms/shared";
import { handleContractError } from "../../../lib/contractError.js";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { canWriteCollection } from "../../../services/rbacService.js";
import { withTenant } from "../../../db/tenant-context.js";
import { attendanceUseCases } from "../../../attendance/use-cases/attendanceUseCases.js";
import { getTenantId } from "./attendanceRecordHandlers.js";

/** Device check-in ingestion: authenticated batch, per-row report, idempotent per student/day. */
export async function attendanceCheckInHandler({
  body,
  request,
}: ContractRouteArgs<(typeof attendanceContract)["ingestCheckIns"]>): Promise<
  ContractRouteResponse<(typeof attendanceContract)["ingestCheckIns"]>
> {
  const user = request.user as User;
  if (!canWriteCollection(user, ATTENDANCE_MODULE_MANIFEST.collectionKey)) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Insufficient permissions" },
    };
  }
  const tenantId = getTenantId(request);
  if (!tenantId) {
    return { status: 403 as const, body: { type: "forbidden", message: "Missing tenant context" } };
  }

  try {
    const result = await withTenant(
      tenantId,
      () => attendanceUseCases.ingestAttendanceCheckIns(tenantId, body, user),
      { readOnly: false },
    );
    return { status: 200 as const, body: result };
  } catch (error) {
    return handleContractError(request, error, {
      status: 500,
      body: { type: "database_error", message: "Failed to ingest check-ins" },
    });
  }
}
