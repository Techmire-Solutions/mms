import { type attendanceContract, type User } from "@mms/shared";
import { handleContractError } from "../../../lib/contractError.js";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { canDeleteCollection, canReadCollection } from "../../../services/rbacService.js";
import { withTenant } from "../../../db/tenant-context.js";
import { attendanceEscalationUseCases } from "../../../attendance/use-cases/attendanceEscalationUseCases.js";
import { getTenantId } from "./attendanceRecordHandlers.js";

/** Chronic-absence escalation routes: read the alert queue, re-scan, resolve. */

function forbid() {
  return { status: 403 as const, body: { type: "forbidden", message: "Insufficient permissions" } };
}

function missingTenant() {
  return { status: 403 as const, body: { type: "forbidden", message: "Missing tenant context" } };
}

export async function attendanceListAbsenceAlertsHandler({
  query,
  request,
}: ContractRouteArgs<(typeof attendanceContract)["listAbsenceAlerts"]>): Promise<
  ContractRouteResponse<(typeof attendanceContract)["listAbsenceAlerts"]>
> {
  const user = request.user as User;
  if (!canReadCollection(user, "attendance_records")) return forbid();
  const tenantId = getTenantId(request);
  if (!tenantId) return missingTenant();

  try {
    const alerts = await withTenant(
      tenantId,
      () => attendanceEscalationUseCases.listAlerts(query ?? {}),
      { readOnly: true },
    );
    return { status: 200 as const, body: { alerts } };
  } catch (error) {
    return handleContractError(request, error, {
      status: 500,
      body: { type: "database_error", message: "Failed to list absence alerts" },
    });
  }
}

export async function attendanceScanAbsenceStreaksHandler({
  request,
}: ContractRouteArgs<(typeof attendanceContract)["scanAbsenceStreaks"]>): Promise<
  ContractRouteResponse<(typeof attendanceContract)["scanAbsenceStreaks"]>
> {
  const user = request.user as User;
  // A manual scan recomputes the whole tenant and can raise alerts for every student: an
  // administrative action, not something any attendance writer should trigger.
  if (!canDeleteCollection(user, "attendance_records")) return forbid();
  const tenantId = getTenantId(request);
  if (!tenantId) return missingTenant();

  try {
    const result = await attendanceEscalationUseCases.scan();
    return { status: 200 as const, body: result };
  } catch (error) {
    return handleContractError(request, error, {
      status: 500,
      body: { type: "database_error", message: "Failed to scan for chronic absence" },
    });
  }
}

export async function attendanceResolveAbsenceAlertHandler({
  params: { id },
  body,
  request,
}: ContractRouteArgs<(typeof attendanceContract)["resolveAbsenceAlert"]>): Promise<
  ContractRouteResponse<(typeof attendanceContract)["resolveAbsenceAlert"]>
> {
  const user = request.user as User;
  if (!canDeleteCollection(user, "attendance_records")) return forbid();
  const tenantId = getTenantId(request);
  if (!tenantId) return missingTenant();

  try {
    const alert = await withTenant(
      tenantId,
      () => attendanceEscalationUseCases.resolveAlert(id, body, user),
      { readOnly: false },
    );
    return { status: 200 as const, body: alert };
  } catch (error) {
    return handleContractError(request, error, {
      status: 500,
      body: { type: "database_error", message: "Failed to resolve the absence alert" },
    });
  }
}
