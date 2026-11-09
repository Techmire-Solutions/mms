import { type User, ATTENDANCE_MODULE_MANIFEST, type attendanceContract } from "@mms/shared";
import { handleContractError } from "../../../lib/contractError.js";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { userHasPermission } from "../../../lib/userPermissionContext.js";
import { createCollectionAuditHelper } from "../../../lib/createCollectionAuditHelper.js";
import { withTenant } from "../../../db/tenant-context.js";
import {
  getAttendanceFieldConfigService,
  updateAttendanceFieldConfigService,
} from "../../../services/attendanceConfigService.js";
import {
  getAttendancePreferencesService,
  updateAttendancePreferencesService,
} from "../../../services/attendancePreferencesService.js";
import { normalizeAttendanceModulePreferences } from "@mms/shared";
import { getTenantId } from "./attendanceRecordHandlers.js";

/**
 * Attendance setup writes: field configuration and module preferences.
 *
 * Both audit inside the write transaction (strict) and record the previous value of the
 * security-relevant keys, so "who turned manual override on / moved the cut-off" is answerable.
 */

const SETUP_WRITE_PERM = ATTENDANCE_MODULE_MANIFEST.permissions.setupWrite;
const auditAttendance = createCollectionAuditHelper("attendance_records", { strict: true });

/** Security-relevant preference keys, with the previous and next value. */
const AUDITED_PREFERENCE_KEYS = [
  "allowManualOverride",
  "cutoffTime",
  "lateThresholdMins",
  "lockAfterSubmit",
  "workingDays",
  "attendanceAlerts",
] as const;

function preferenceDiff(
  before: Record<string, unknown> | null,
  after: Record<string, unknown>,
): { oldState: Record<string, unknown>; newState: Record<string, unknown>; changed: string[] } {
  const oldState: Record<string, unknown> = {};
  const newState: Record<string, unknown> = {};
  const changed: string[] = [];
  for (const key of AUDITED_PREFERENCE_KEYS) {
    const previous = before?.[key];
    const next = after[key];
    if (JSON.stringify(previous ?? null) === JSON.stringify(next ?? null)) continue;
    changed.push(key);
    oldState[key] = previous ?? null;
    newState[key] = next ?? null;
  }
  return { oldState, newState, changed };
}

export async function attendanceUpdateFieldConfigHandler({
  body,
  request,
}: ContractRouteArgs<(typeof attendanceContract)["updateFieldConfig"]>): Promise<
  ContractRouteResponse<(typeof attendanceContract)["updateFieldConfig"]>
> {
  const user = request.user as User;
  if (!userHasPermission(user, SETUP_WRITE_PERM)) {
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
    const saved = await withTenant(
      tenantId,
      async (tx) => {
        const before = (await getAttendanceFieldConfigService()) ?? null;
        const next = await updateAttendanceFieldConfigService(body);
        // Same transaction as the write: a failed audit fails the save.
        await auditAttendance(
          user,
          "UPDATE_ATTENDANCE_CONFIG",
          "Updated attendance field configuration",
          "field-config",
          {
            tx,
            oldState: before ? { config: before } : null,
            newState: { config: Object.assign({}, next) },
          },
        );
        return next;
      },
      { readOnly: false },
    );
    return { status: 200 as const, body: { success: true, config: Object.assign({}, saved) } };
  } catch (error) {
    return handleContractError(request, error, {
      status: 500,
      body: { type: "database_error", message: "Failed to save attendance field config" },
    });
  }
}

export async function attendanceUpdatePreferencesHandler({
  body,
  request,
}: ContractRouteArgs<(typeof attendanceContract)["updatePreferences"]>): Promise<
  ContractRouteResponse<(typeof attendanceContract)["updatePreferences"]>
> {
  const user = request.user as User;
  if (!userHasPermission(user, SETUP_WRITE_PERM)) {
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
    const normalized = normalizeAttendanceModulePreferences(body);
    await withTenant(
      tenantId,
      async (tx) => {
        const previous = await getAttendancePreferencesService();
        const before = previous ? (previous as unknown as Record<string, unknown>) : null;
        await updateAttendancePreferencesService(normalized);
        const diff = preferenceDiff(before, normalized as unknown as Record<string, unknown>);
        await auditAttendance(
          user,
          "UPDATE_ATTENDANCE_PREFERENCES",
          `Updated attendance preferences${diff.changed.length > 0 ? `: ${diff.changed.join(", ")}` : ""}`,
          "preferences",
          { tx, oldState: diff.oldState, newState: diff.newState, minimizeDelta: false },
        );
      },
      { readOnly: false },
    );
    return { status: 200 as const, body: { success: true, preferences: normalized } };
  } catch (error) {
    return handleContractError(request, error, {
      status: 500,
      body: { type: "database_error", message: "Failed to save attendance preferences" },
    });
  }
}
