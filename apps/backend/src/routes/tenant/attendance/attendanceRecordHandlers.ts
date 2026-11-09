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

const COLLECTION = ATTENDANCE_MODULE_MANIFEST.collectionKey;

/**
 * Override justification header, forwarded to the policy gate.
 *
 * Only the delete-level override path needs it, so ordinary marking stays header-free; a write that
 * overrides a lock or the cut-off without one is refused with 422.
 */
export function readAttendanceReason(request: {
  headers: Record<string, unknown>;
}): string | undefined {
  const raw = request.headers["x-attendance-reason"];
  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : undefined;
}

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
    // Teacher row-scope, instructional-day and write-policy checks all run inside the use case's
    // transaction, so this handler only authorises and delegates.
    const item = await attendanceUseCases.createAttendanceRecord(
      { ...body, markedBy: user.id },
      user,
      readAttendanceReason(request),
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
    // Optional OCC token (mms-api-interface §6): echo the `version` you read. Sessions use the same
    // header convention; attendance keeps it optional so a grid without tokens still saves (last
    // writer wins) instead of returning 428 to every legacy client.
    const expectedVersionHeader = request.headers["x-expected-version"];
    const expectedVersion =
      typeof expectedVersionHeader === "string" && expectedVersionHeader.trim() !== ""
        ? Number(expectedVersionHeader)
        : undefined;
    const updated = await attendanceUseCases.updateAttendanceRecordById(
      id,
      { ...bodyRecord, id, markedBy: user.id },
      user,
      expectedVersion,
      readAttendanceReason(request),
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
    const deleted = await attendanceUseCases.deleteAttendanceRecordById(id, user, deletionReason);
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
    const restored = await attendanceUseCases.restoreAttendanceRecordById(id, user);
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
