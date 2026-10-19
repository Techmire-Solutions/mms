import {
  type User,
  ATTENDANCE_MODULE_MANIFEST,
  type attendanceContract,
} from "@mms/shared";
import { handleContractError } from "../../../lib/contractError.js";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import {
  canDeleteCollection,
  canWriteCollection,
} from "../../../services/rbacService.js";
import { withTenant } from "../../../db/tenant-context.js";
import { attendanceUseCases } from "../../../attendance/use-cases/attendanceUseCases.js";
import { assertTeacherClassScope } from "../../../sessions/use-cases/teacherSectionScope.js";
import { assertInstructionalDays } from "../../../attendance/use-cases/instructionalDayGuard.js";
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
    await assertTeacherClassScope(
      user,
      tenantId,
      body.records.map((r) => ({ classId: r.classId, date: r.date })),
    );
    await assertInstructionalDays(
      tenantId,
      body.records.map((r) => ({ classId: r.classId, studentId: r.studentId, date: r.date })),
      user.id,
    );
    const records = await withTenant(
      tenantId,
      () =>
        attendanceUseCases.upsertAttendanceRecords(
          body.records.map((r) => ({ ...r, markedBy: user.id })),
        ),
      { readOnly: false },
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
    const result = await withTenant(
      tenantId,
      () =>
        attendanceUseCases.bulkSoftDeleteAttendance(
          body.ids.map(String),
          String(user.id),
          body.deletionReason,
        ),
      { readOnly: false },
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
    const result = await withTenant(
      tenantId,
      () => attendanceUseCases.bulkRestoreAttendance(body.ids.map(String), String(user.id)),
      { readOnly: false },
    );
    return { status: 200 as const, body: { success: true, ...result } };
  } catch (error) {
    return handleContractError(request, error, {
      status: 500,
      body: { type: "database_error", message: "Failed to bulk restore attendance records" },
    });
  }
}
