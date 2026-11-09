import { type attendanceContract, type User } from "@mms/shared";
import { handleContractError } from "../../../lib/contractError.js";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { canReadCollection } from "../../../services/rbacService.js";
import { withTenant } from "../../../db/tenant-context.js";
import { attendanceUseCases } from "../../../attendance/use-cases/attendanceUseCases.js";
import { getTenantId } from "./attendanceRecordHandlers.js";

/**
 * Marking matrix: reads the day's real marks for one class/section.
 *
 * Replaces the grid's previous source — a workspace-wide collection capped at 100 rows — which
 * silently dropped marks and let defaults overwrite recorded absences.
 */
export async function attendanceRosterHandler({
  query,
  request,
}: ContractRouteArgs<(typeof attendanceContract)["getRoster"]>): Promise<
  ContractRouteResponse<(typeof attendanceContract)["getRoster"]>
> {
  const user = request.user as User;
  if (!canReadCollection(user, "attendance_records")) {
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
    const records = await withTenant(
      tenantId,
      () =>
        attendanceUseCases.loadAttendanceRoster({
          classId: query.classId,
          date: query.date,
          ...(query.sectionId ? { sectionId: query.sectionId } : {}),
        }),
      { readOnly: true },
    );
    return { status: 200 as const, body: { records } };
  } catch (error) {
    return handleContractError(request, error, {
      status: 500,
      body: { type: "database_error", message: "Failed to load the attendance roster" },
    });
  }
}
