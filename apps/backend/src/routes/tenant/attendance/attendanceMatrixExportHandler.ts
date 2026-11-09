import { type attendanceContract, type User, ATTENDANCE_MODULE_MANIFEST } from "@mms/shared";
import { handleContractError } from "../../../lib/contractError.js";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { canReadCollection } from "../../../services/rbacService.js";
import {
  enqueueBackgroundJob,
  getUserBackgroundJob,
  QueueUnavailableError,
} from "../../../services/backgroundJobWorkerService.js";
import { buildBackgroundJobId, buildDeterministicJobKey } from "../../../lib/backgroundJobIds.js";
import { recordModernAuditEvent } from "../../../services/auditTrailService.js";
import { getTenantId } from "./attendanceRecordHandlers.js";
import { attendanceUseCases } from "../../../attendance/use-cases/attendanceUseCases.js";
import {
  assertMatrixCellBudget,
  resolveMatrixDates,
} from "../../../services/attendanceMatrixExportService.js";

/**
 * Register / monthly-matrix export.
 *
 * The range and (for XLSX) the cell budget are validated **before** enqueueing, so an impossible
 * request is a 400/413 instead of a job that fails in the worker. The matrix itself streams in the
 * job; XLSX is materialised but capped.
 */
export async function attendanceMatrixExportHandler({
  body,
  request,
}: ContractRouteArgs<(typeof attendanceContract)["exportMatrix"]>): Promise<
  ContractRouteResponse<(typeof attendanceContract)["exportMatrix"]>
> {
  const user = request.user as User;
  if (!canReadCollection(user, ATTENDANCE_MODULE_MANIFEST.collectionKey)) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Insufficient permissions" },
    };
  }
  const tenantId = getTenantId(request);
  if (!tenantId) {
    return { status: 403 as const, body: { type: "forbidden", message: "Missing tenant context" } };
  }

  const dates = resolveMatrixDates(body);
  if (!dates.ok) {
    return { status: 400 as const, body: { type: "validation_error", message: dates.message } };
  }

  try {
    if (body.format === "xlsx") {
      const roster = await attendanceUseCases.countMatrixStudents(
        {
          classId: body.classId,
          ...(body.sectionId ? { sectionId: body.sectionId } : {}),
        },
        tenantId,
      );
      // Throws a 413-typed error when the matrix would be too large to materialise.
      assertMatrixCellBudget(dates.dates, roster);
    }

    const bucket = new Date().toISOString().slice(0, 13);
    const idempotencyKey = buildDeterministicJobKey({
      moduleId: "attendance",
      kind: "matrix-export",
      payload: { tenant: tenantId, request: body, bucket },
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
        kind: "matrix-export",
        status: "running",
        label: `Exporting attendance register (${body.dateFrom} → ${body.dateTo})`,
        createdAt: new Date().toISOString(),
      },
      { request: body, format: body.format },
    );

    await recordModernAuditEvent({
      workspaceSubdomain: tenantId,
      tableName: "attendance",
      recordId: job.id,
      actionType: "CREATE",
      realUserId: String(user.id),
      newState: {
        action: "attendance.register.export",
        classId: body.classId,
        sectionId: body.sectionId ?? null,
        dateFrom: body.dateFrom,
        dateTo: body.dateTo,
        format: body.format,
        jobId: job.id,
      },
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
      body: { type: "database_error", message: "Failed to queue the register export" },
    });
  }
}
