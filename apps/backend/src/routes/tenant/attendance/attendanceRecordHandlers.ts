import {
  isQueryFlagTrue,
  type User,
  ATTENDANCE_MODULE_MANIFEST,
  type attendanceContract,
} from "@mms/shared";
import { handleContractError } from "../../../lib/contractError.js";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import {
  canDeleteCollection,
  canReadCollection,
  canWriteCollection,
} from "../../../services/rbacService.js";
import { withTenant } from "../../../db/tenant-context.js";
import { getRequestTenant } from "../../../lib/tenantContext.js";
import { attendanceUseCases } from "../../../attendance/use-cases/attendanceUseCases.js";
import { assertTeacherClassScope } from "../../../sessions/use-cases/teacherSectionScope.js";
import { assertInstructionalDays } from "../../../attendance/use-cases/instructionalDayGuard.js";

const COLLECTION = ATTENDANCE_MODULE_MANIFEST.collectionKey;

export function getTenantId(request: { tenant?: { id: string } }): string | null {
  return request.tenant?.id || getRequestTenant() || null;
}

export async function attendanceListHandler({
  query,
  request,
}: ContractRouteArgs<(typeof attendanceContract)["list"]>): Promise<
  ContractRouteResponse<(typeof attendanceContract)["list"]>
> {
  const user = request.user as User;
  if (!canReadCollection(user, COLLECTION)) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Insufficient permissions" },
    };
  }

  const includeDeleted = isQueryFlagTrue(query?.includeDeleted);
  if (includeDeleted && !canDeleteCollection(user, COLLECTION)) {
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
        attendanceUseCases.loadAttendancePage({
          ...query,
          sortDir: (query?.sortDir || undefined) as "asc" | "desc" | undefined,
          includeDeleted,
        }),
      { readOnly: true },
    );
    return { status: 200 as const, body: result };
  } catch (error) {
    return handleContractError(request, error, {
      status: 500,
      body: { type: "database_error", message: "Failed to list attendance" },
    });
  }
}

export async function attendanceCreateHandler({
  body,
  request,
}: ContractRouteArgs<(typeof attendanceContract)["create"]>): Promise<
  ContractRouteResponse<(typeof attendanceContract)["create"]>
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
    await assertTeacherClassScope(user, tenantId, [{ classId: body.classId, date: body.date }]);
    await assertInstructionalDays(
      tenantId,
      [{ classId: body.classId, studentId: body.studentId, date: body.date }],
      user.id,
    );
    const item = await withTenant(
      tenantId,
      () => attendanceUseCases.createAttendanceRecord({ ...body, markedBy: user.id }),
      { readOnly: false },
    );
    return { status: 201 as const, body: item };
  } catch (error) {
    return handleContractError(request, error, {
      status: 500,
      body: { type: "database_error", message: "Failed to create attendance" },
    });
  }
}

export async function attendanceUpdateHandler({
  params: { id },
  body,
  request,
}: ContractRouteArgs<(typeof attendanceContract)["update"]>): Promise<
  ContractRouteResponse<(typeof attendanceContract)["update"]>
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

  const bodyRecord = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  if (bodyRecord.id !== undefined && bodyRecord.id !== null && String(bodyRecord.id) !== id) {
    return {
      status: 400 as const,
      body: { type: "validation_error", message: "Body id does not match the URL id" },
    };
  }

  try {
    const updated = await withTenant(
      tenantId,
      async () => {
        const existing = await attendanceUseCases.loadAttendanceRecordById(id);
        const classId = String(bodyRecord.classId ?? existing?.classId ?? "");
        const date = String(bodyRecord.date ?? existing?.date ?? "");
        await assertTeacherClassScope(user, tenantId, [{ classId, date }]);
        if (classId !== existing?.classId || date !== existing?.date) {
          await assertInstructionalDays(
            tenantId,
            [
              {
                classId,
                studentId: String(bodyRecord.studentId ?? existing?.studentId ?? ""),
                date,
              },
            ],
            user.id,
          );
        }
        return attendanceUseCases.updateAttendanceRecordById(id, {
          ...bodyRecord,
          id,
          markedBy: user.id,
        });
      },
      { readOnly: false },
    );
    if (!updated) {
      return {
        status: 404 as const,
        body: { type: "not_found", message: "Attendance record not found" },
      };
    }
    return { status: 200 as const, body: { record: updated } };
  } catch (error) {
    return handleContractError(request, error, {
      status: 500,
      body: { type: "database_error", message: "Failed to update attendance" },
    });
  }
}

export async function attendanceDeleteHandler({
  params: { id },
  body,
  request,
}: ContractRouteArgs<(typeof attendanceContract)["delete"]>): Promise<
  ContractRouteResponse<(typeof attendanceContract)["delete"]>
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
    const deletionReason =
      body && typeof body === "object" && "deletionReason" in body
        ? (body as { deletionReason?: string }).deletionReason
        : undefined;
    const deleted = await withTenant(
      tenantId,
      () => attendanceUseCases.deleteAttendanceRecordById(id, String(user.id), deletionReason),
      { readOnly: false },
    );
    if (!deleted) {
      return {
        status: 404 as const,
        body: { type: "not_found", message: "Attendance record not found" },
      };
    }
    return { status: 200 as const, body: { success: true } };
  } catch (error) {
    return handleContractError(request, error, {
      status: 500,
      body: { type: "database_error", message: "Failed to delete attendance" },
    });
  }
}

export async function attendanceRestoreHandler({
  params: { id },
  request,
}: ContractRouteArgs<(typeof attendanceContract)["restore"]>): Promise<
  ContractRouteResponse<(typeof attendanceContract)["restore"]>
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
    const restored = await withTenant(
      tenantId,
      () => attendanceUseCases.restoreAttendanceRecordById(id, String(user.id)),
      { readOnly: false },
    );
    if (!restored) {
      return {
        status: 404 as const,
        body: { type: "not_found", message: "Attendance record not found" },
      };
    }
    return { status: 200 as const, body: { success: true } };
  } catch (error) {
    return handleContractError(request, error, {
      status: 500,
      body: { type: "database_error", message: "Failed to restore attendance" },
    });
  }
}
