import { type attendanceContract, type User } from "@mms/shared";
import { handleContractError } from "../../../lib/contractError.js";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import {
  canDeleteCollection,
  canReadCollection,
  canWriteCollection,
} from "../../../services/rbacService.js";
import { withTenant } from "../../../db/tenant-context.js";
import { attendanceExcuseUseCases } from "../../../attendance/use-cases/attendanceExcuseUseCases.js";
import { getTenantId } from "./attendanceRecordHandlers.js";

/**
 * Excuse / leave workflow routes.
 *
 * Authorisation: reading needs `attendance.read`; filing a request needs `attendance.write`;
 * deciding one is an elevated action (it rewrites historical evidence) and needs the module's
 * delete-level permission. Cancelling stays at write level so a submitter can withdraw a request.
 */

function forbid() {
  return { status: 403 as const, body: { type: "forbidden", message: "Insufficient permissions" } };
}

function missingTenant() {
  return { status: 403 as const, body: { type: "forbidden", message: "Missing tenant context" } };
}

export async function attendanceListExcusesHandler({
  query,
  request,
}: ContractRouteArgs<(typeof attendanceContract)["listLeaves"]>): Promise<
  ContractRouteResponse<(typeof attendanceContract)["listLeaves"]>
> {
  const user = request.user as User;
  if (!canReadCollection(user, "attendance_records")) return forbid();
  const tenantId = getTenantId(request);
  if (!tenantId) return missingTenant();

  try {
    const leaves = await withTenant(
      tenantId,
      () => attendanceExcuseUseCases.listExcuses(query ?? {}, user),
      { readOnly: true },
    );
    return { status: 200 as const, body: { leaves } };
  } catch (error) {
    return handleContractError(request, error, {
      status: 500,
      body: { type: "database_error", message: "Failed to list excuses" },
    });
  }
}

export async function attendanceSubmitExcuseHandler({
  body,
  request,
}: ContractRouteArgs<(typeof attendanceContract)["submitLeave"]>): Promise<
  ContractRouteResponse<(typeof attendanceContract)["submitLeave"]>
> {
  const user = request.user as User;
  if (!canWriteCollection(user, "attendance_records")) return forbid();
  const tenantId = getTenantId(request);
  if (!tenantId) return missingTenant();

  try {
    const leave = await withTenant(
      tenantId,
      () => attendanceExcuseUseCases.submitExcuse(body, user),
      {
        readOnly: false,
      },
    );
    return { status: 201 as const, body: leave };
  } catch (error) {
    return handleContractError(request, error, {
      status: 500,
      body: { type: "database_error", message: "Failed to submit the excuse" },
    });
  }
}

export async function attendanceReviewExcuseHandler({
  params: { id },
  body,
  request,
}: ContractRouteArgs<(typeof attendanceContract)["reviewLeave"]>): Promise<
  ContractRouteResponse<(typeof attendanceContract)["reviewLeave"]>
> {
  const user = request.user as User;
  if (!canDeleteCollection(user, "attendance_records")) return forbid();
  const tenantId = getTenantId(request);
  if (!tenantId) return missingTenant();

  try {
    const leave = await withTenant(
      tenantId,
      () => attendanceExcuseUseCases.reviewExcuse(id, body, user),
      { readOnly: false },
    );
    return { status: 200 as const, body: leave };
  } catch (error) {
    return handleContractError(request, error, {
      status: 500,
      body: { type: "database_error", message: "Failed to record the excuse decision" },
    });
  }
}

export async function attendanceCancelExcuseHandler({
  params: { id },
  body,
  request,
}: ContractRouteArgs<(typeof attendanceContract)["cancelLeave"]>): Promise<
  ContractRouteResponse<(typeof attendanceContract)["cancelLeave"]>
> {
  const user = request.user as User;
  if (
    !canWriteCollection(user, "attendance_records") &&
    !canDeleteCollection(user, "attendance_records")
  ) {
    return forbid();
  }
  const tenantId = getTenantId(request);
  if (!tenantId) return missingTenant();

  try {
    const leave = await withTenant(
      tenantId,
      () => attendanceExcuseUseCases.cancelExcuse(id, body ?? {}, user),
      { readOnly: false },
    );
    return { status: 200 as const, body: leave };
  } catch (error) {
    return handleContractError(request, error, {
      status: 500,
      body: { type: "database_error", message: "Failed to cancel the excuse" },
    });
  }
}
