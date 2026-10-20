import {
  type User,
  ATTENDANCE_MODULE_MANIFEST,
  type attendanceContract,
  roleHasPermission,
  normalizeAttendanceModulePreferences,
  normalizeAttendanceReportComparisonQuery,
  parseComparisonQueryParams,
  ATTENDANCE_LOOKUP_KINDS,
  type AttendanceLookupKind,
} from "@mms/shared";
import { handleContractError } from "../../../lib/contractError.js";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { canReadCollection } from "../../../services/rbacService.js";
import { withTenant } from "../../../db/tenant-context.js";
import { attendanceUseCases } from "../../../attendance/use-cases/attendanceUseCases.js";
import {
  getAttendanceFieldConfigService,
  updateAttendanceFieldConfigService,
} from "../../../services/attendanceConfigService.js";
import {
  getAttendancePreferencesService,
  updateAttendancePreferencesService,
} from "../../../services/attendancePreferencesService.js";
import { loadAttendanceLookupsMap } from "../../../services/attendanceLookupsService.js";
import { createCollectionAuditHelper } from "../../../lib/createCollectionAuditHelper.js";
import { getTenantId } from "./attendanceRecordHandlers.js";

const COLLECTION = ATTENDANCE_MODULE_MANIFEST.collectionKey;
const SETUP_WRITE_PERM = ATTENDANCE_MODULE_MANIFEST.permissions.setupWrite;
const auditAttendance = createCollectionAuditHelper("attendance_records");

export async function attendanceWidgetAggregatesHandler({
  body,
  request,
}: ContractRouteArgs<(typeof attendanceContract)["widgetAggregates"]>): Promise<
  ContractRouteResponse<(typeof attendanceContract)["widgetAggregates"]>
> {
  const user = request.user as User;
  if (!canReadCollection(user, COLLECTION)) {
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
      () => attendanceUseCases.loadAttendanceWidgetAggregates(body.widgets),
      { readOnly: true },
    );
    return { status: 200 as const, body: result };
  } catch (error) {
    return handleContractError(request, error, {
      status: 500,
      body: { type: "database_error", message: "Failed to load widget aggregates" },
    });
  }
}

export async function attendanceReportAggregatesHandler({
  query,
  request,
}: ContractRouteArgs<(typeof attendanceContract)["reportAggregates"]>): Promise<
  ContractRouteResponse<(typeof attendanceContract)["reportAggregates"]>
> {
  const user = request.user as User;
  if (!canReadCollection(user, COLLECTION)) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Insufficient permissions" },
    };
  }
  try {
    const comparisonQuery = normalizeAttendanceReportComparisonQuery(
      parseComparisonQueryParams(query),
    );
    const aggregates = await attendanceUseCases.loadAttendanceReportAggregates({
      ...comparisonQuery,
      ...(query.classId?.trim() ? { classId: query.classId.trim() } : {}),
    });
    return { status: 200 as const, body: aggregates };
  } catch (error) {
    return handleContractError(request, error, {
      status: 500,
      body: { type: "database_error", message: "Failed to load attendance report aggregates" },
    });
  }
}

export async function attendanceGetFieldConfigHandler({
  request,
}: ContractRouteArgs<(typeof attendanceContract)["getFieldConfig"]>): Promise<
  ContractRouteResponse<(typeof attendanceContract)["getFieldConfig"]>
> {
  const user = request.user as User;
  if (!canReadCollection(user, COLLECTION)) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Insufficient permissions" },
    };
  }
  try {
    const config = await getAttendanceFieldConfigService();
    return {
      status: 200 as const,
      body: { config: (config ?? null) as Record<string, unknown> | null },
    };
  } catch (error) {
    return handleContractError(request, error, {
      status: 500,
      body: { type: "database_error", message: "Failed to load attendance field config" },
    });
  }
}

export async function attendanceUpdateFieldConfigHandler({
  body,
  request,
}: ContractRouteArgs<(typeof attendanceContract)["updateFieldConfig"]>): Promise<
  ContractRouteResponse<(typeof attendanceContract)["updateFieldConfig"]>
> {
  const user = request.user as User;
  if (!roleHasPermission(user.role, SETUP_WRITE_PERM)) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Insufficient permissions" },
    };
  }
  try {
    const saved = await updateAttendanceFieldConfigService(body);
    await auditAttendance(
      user,
      "UPDATE_ATTENDANCE_CONFIG",
      "Updated attendance field configuration",
      "field-config",
    );
    return { status: 200 as const, body: { success: true, config: Object.assign({}, saved) } };
  } catch (error) {
    return handleContractError(request, error, {
      status: 500,
      body: { type: "database_error", message: "Failed to save attendance field config" },
    });
  }
}

export async function attendanceGetPreferencesHandler({
  request,
}: ContractRouteArgs<(typeof attendanceContract)["getPreferences"]>): Promise<
  ContractRouteResponse<(typeof attendanceContract)["getPreferences"]>
> {
  const user = request.user as User;
  if (!canReadCollection(user, COLLECTION)) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Insufficient permissions" },
    };
  }
  try {
    const raw = await getAttendancePreferencesService();
    const preferences = normalizeAttendanceModulePreferences(raw ?? undefined);
    return { status: 200 as const, body: { preferences } };
  } catch (error) {
    return handleContractError(request, error, {
      status: 500,
      body: { type: "database_error", message: "Failed to load attendance preferences" },
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
  if (!roleHasPermission(user.role, SETUP_WRITE_PERM)) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Insufficient permissions" },
    };
  }
  try {
    const normalized = normalizeAttendanceModulePreferences(body);
    await updateAttendancePreferencesService(normalized);
    await auditAttendance(
      user,
      "UPDATE_ATTENDANCE_PREFERENCES",
      "Updated attendance module preferences",
      "preferences",
    );
    return { status: 200 as const, body: { success: true, preferences: normalized } };
  } catch (error) {
    return handleContractError(request, error, {
      status: 500,
      body: { type: "database_error", message: "Failed to save attendance preferences" },
    });
  }
}

export async function attendanceGetLookupsHandler({
  request,
}: ContractRouteArgs<(typeof attendanceContract)["getLookups"]>): Promise<
  ContractRouteResponse<(typeof attendanceContract)["getLookups"]>
> {
  const user = request.user as User;
  if (!canReadCollection(user, COLLECTION)) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Insufficient permissions" },
    };
  }
  try {
    const lookups = await loadAttendanceLookupsMap();
    return { status: 200 as const, body: { lookups } };
  } catch (error) {
    return handleContractError(request, error, {
      status: 500,
      body: { type: "database_error", message: "Failed to load attendance lookups" },
    });
  }
}

export async function attendanceGetLookupKindHandler({
  params: { kind },
  request,
}: ContractRouteArgs<(typeof attendanceContract)["getLookupKind"]>): Promise<
  ContractRouteResponse<(typeof attendanceContract)["getLookupKind"]>
> {
  const user = request.user as User;
  if (!canReadCollection(user, COLLECTION)) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Insufficient permissions" },
    };
  }
  if (!ATTENDANCE_LOOKUP_KINDS.includes(kind as AttendanceLookupKind)) {
    return {
      status: 403 as const,
      body: { type: "validation_error", message: `Unknown lookup kind: ${kind}` },
    };
  }
  try {
    const map = await loadAttendanceLookupsMap();
    return { status: 200 as const, body: map[kind as AttendanceLookupKind] };
  } catch (error) {
    return handleContractError(request, error, {
      status: 500,
      body: { type: "database_error", message: "Failed to load attendance lookup kind" },
    });
  }
}
