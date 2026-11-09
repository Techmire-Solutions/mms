import { type attendanceContract, type User } from "@mms/shared";
import { handleContractError } from "../../../lib/contractError.js";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { canDeleteCollection, canReadCollection } from "../../../services/rbacService.js";
import { withTenant } from "../../../db/tenant-context.js";
import { attendanceEscalationUseCases } from "../../../attendance/use-cases/attendanceEscalationUseCases.js";
import { getTenantId } from "./attendanceRecordHandlers.js";
import {
  enqueueBackgroundJob,
  getUserBackgroundJob,
  QueueUnavailableError,
} from "../../../services/backgroundJobWorkerService.js";
import { buildBackgroundJobId, buildDeterministicJobKey } from "../../../lib/backgroundJobIds.js";
import { recordModernAuditEvent } from "../../../services/auditTrailService.js";

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
    // Queue the scan instead of walking every workspace inside the request: the job gets a deadline,
    // BullMQ retries, the DLQ record and a tray entry. One job per workspace per hour bucket, so a
    // double-submit collapses onto the same job id.
    const bucket = new Date().toISOString().slice(0, 13);
    const idempotencyKey = buildDeterministicJobKey({
      moduleId: "attendance",
      kind: "absence-scan",
      payload: { tenant: tenantId, bucket },
    });
    const jobId = buildBackgroundJobId(tenantId, String(user.id), idempotencyKey);

    const existing = await getUserBackgroundJob(String(user.id), jobId);
    if (existing) return { status: 202 as const, body: { job: existing } };

    const job = await enqueueBackgroundJob(
      tenantId,
      String(user.id),
      {
        id: jobId,
        moduleId: "attendance",
        kind: "absence-scan",
        status: "running",
        label: "Scanning for chronic absence…",
        createdAt: new Date().toISOString(),
      },
      { requestedBy: String(user.id) },
    );

    await recordModernAuditEvent({
      workspaceSubdomain: tenantId,
      tableName: "attendance_absence_alerts",
      recordId: job.id,
      actionType: "CREATE",
      realUserId: String(user.id),
      newState: { action: "attendance.scan.queue", jobId: job.id },
    });

    return { status: 202 as const, body: { job } };
  } catch (error) {
    if (error instanceof QueueUnavailableError) {
      return {
        status: 503 as const,
        body: { type: "service_unavailable", message: error.message },
      };
    }
    return handleContractError(request, error, {
      status: 500,
      body: { type: "database_error", message: "Failed to queue the chronic-absence scan" },
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
