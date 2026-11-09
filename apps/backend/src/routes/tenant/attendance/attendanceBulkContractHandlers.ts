import { type User, ATTENDANCE_MODULE_MANIFEST, type attendanceContract } from "@mms/shared";
import { handleContractError } from "../../../lib/contractError.js";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { canDeleteCollection, canWriteCollection } from "../../../services/rbacService.js";
import { attendanceUseCases } from "../../../attendance/use-cases/attendanceUseCases.js";
import { getTenantId } from "./attendanceRecordHandlers.js";

const COLLECTION = ATTENDANCE_MODULE_MANIFEST.collectionKey;

export async function attendanceBulkHandler({
  body,
  request,
}: ContractRouteArgs<(typeof attendanceContract)["bulk"]>): Promise<
  ContractRouteResponse<(typeof attendanceContract)["bulk"]>
> {
  const user = request.user as User;
  if (!canWriteCollection(user, COLLECTION)) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Insufficient permissions" },
    };
  }

  const tenantId = getTenantId(request);
  if (!tenantId) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Missing tenant context" },
    };
  }

  try {
    // One atomic transaction inside the use case: enrolment, teacher row-scope, instructional-day
    // and write-policy checks, the upsert, and the per-row audit all commit or roll back together.
    const records = await attendanceUseCases.upsertAttendanceRecords(
      body.records.map((r) => ({ ...r, markedBy: user.id })),
      user,
      // One justification for the batch; required only if the save overrides a lock or cut-off.
      body.overrideReason,
    );
    return { status: 200 as const, body: { records } };
  } catch (error) {
    return handleContractError(request, error, {
      status: 500,
      body: { type: "database_error", message: "Failed to update attendance records" },
    });
  }
}

export async function attendanceBulkDeleteHandler({
  body,
  request,
}: ContractRouteArgs<(typeof attendanceContract)["bulkDelete"]>): Promise<
  ContractRouteResponse<(typeof attendanceContract)["bulkDelete"]>
> {
  const user = request.user as User;
  if (!canDeleteCollection(user, COLLECTION)) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Insufficient permissions" },
    };
  }

  const tenantId = getTenantId(request);
  if (!tenantId) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Missing tenant context" },
    };
  }

  try {
    const result = await attendanceUseCases.bulkSoftDeleteAttendance(
      body.ids.map(String),
      user,
      body.deletionReason,
    );
    return { status: 200 as const, body: { success: true, ...result } };
  } catch (error) {
    return handleContractError(request, error, {
      status: 500,
      body: { type: "database_error", message: "Failed to bulk delete attendance records" },
    });
  }
}

export async function attendanceBulkRestoreHandler({
  body,
  request,
}: ContractRouteArgs<(typeof attendanceContract)["bulkRestore"]>): Promise<
  ContractRouteResponse<(typeof attendanceContract)["bulkRestore"]>
> {
  const user = request.user as User;
  if (!canDeleteCollection(user, COLLECTION)) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Insufficient permissions" },
    };
  }

  const tenantId = getTenantId(request);
  if (!tenantId) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Missing tenant context" },
    };
  }

  try {
    const result = await attendanceUseCases.bulkRestoreAttendance(body.ids.map(String), user);
    return { status: 200 as const, body: { success: true, ...result } };
  } catch (error) {
    return handleContractError(request, error, {
      status: 500,
      body: { type: "database_error", message: "Failed to bulk restore attendance records" },
    });
  }
}
