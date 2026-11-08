import { type attendanceContract, type User, ATTENDANCE_MODULE_MANIFEST } from "@mms/shared";
import { handleContractError } from "../../../lib/contractError.js";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { canDeleteCollection, canWriteCollection } from "../../../services/rbacService.js";
import { withTenant } from "../../../db/tenant-context.js";
import {
  reopenSubmittedAttendanceDay,
  submitAttendanceDay,
} from "../../../attendance/use-cases/attendanceLeaveUseCases.js";
import { getTenantId } from "./attendanceRecordHandlers.js";

const COLLECTION = ATTENDANCE_MODULE_MANIFEST.collectionKey;

function serialise(row: {
  classId: string;
  date: string;
  submittedAt: Date;
  submittedBy: string | null;
  reopenedAt: Date | null;
  reopenedBy: string | null;
  reopenReason: string | null;
  locked: boolean;
}) {
  return {
    classId: row.classId,
    date: row.date,
    submittedAt: row.submittedAt.toISOString(),
    submittedBy: row.submittedBy,
    reopenedAt: row.reopenedAt ? row.reopenedAt.toISOString() : null,
    reopenedBy: row.reopenedBy,
    reopenReason: row.reopenReason,
    locked: row.locked,
  };
}

/**
 * Submit a class roster day (`lockAfterSubmit`).
 *
 * Idempotent: submitting an already-locked day returns the stored state with
 * `alreadySubmitted: true` rather than moving the timestamp.
 */
export async function attendanceSubmitDayHandler({
  params,
  request,
}: ContractRouteArgs<(typeof attendanceContract)["submitDay"]>): Promise<
  ContractRouteResponse<(typeof attendanceContract)["submitDay"]>
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
    return { status: 403 as const, body: { type: "forbidden", message: "Missing tenant context" } };
  }

  try {
    const { submission, alreadySubmitted } = await withTenant(
      tenantId,
      () =>
        submitAttendanceDay(tenantId, {
          classId: params.classId,
          date: params.date,
          submittedBy: String(user.id),
        }),
      { readOnly: false },
    );
    return {
      status: 200 as const,
      body: { submission: serialise(submission), alreadySubmitted },
    };
  } catch (error) {
    return handleContractError(request, error, {
      status: 500,
      body: { type: "database_error", message: "Failed to submit attendance day" },
    });
  }
}

/** Reopen a submitted day. Admin-only: reopening is an override of the lock. */
export async function attendanceReopenDayHandler({
  params,
  body,
  request,
}: ContractRouteArgs<(typeof attendanceContract)["reopenDay"]>): Promise<
  ContractRouteResponse<(typeof attendanceContract)["reopenDay"]>
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
    return { status: 403 as const, body: { type: "forbidden", message: "Missing tenant context" } };
  }

  try {
    const submission = await withTenant(
      tenantId,
      () =>
        reopenSubmittedAttendanceDay(tenantId, {
          classId: params.classId,
          date: params.date,
          reopenedBy: String(user.id),
          reason: body?.reason ?? null,
        }),
      { readOnly: false },
    );
    return {
      status: 200 as const,
      body: { submission: serialise(submission), alreadySubmitted: false },
    };
  } catch (error) {
    return handleContractError(request, error, {
      status: 500,
      body: { type: "database_error", message: "Failed to reopen attendance day" },
    });
  }
}
