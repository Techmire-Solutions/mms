import {
  type User,
  ATTENDANCE_MODULE_MANIFEST,
  type attendanceContract,
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
import { getAttendanceFieldConfigService } from "../../../services/attendanceConfigService.js";
import { getAttendancePreferencesService } from "../../../services/attendancePreferencesService.js";
import { loadAttendanceLookupsMap } from "../../../services/attendanceLookupsService.js";
import { getTenantId } from "./attendanceRecordHandlers.js";

const COLLECTION = ATTENDANCE_MODULE_MANIFEST.collectionKey;
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

/** Days already carrying attendance, for the Reports → Coverage ("not marked") report. */
export async function attendanceMarkedDatesHandler({
  query,
  request,
}: ContractRouteArgs<(typeof attendanceContract)["markedDates"]>): Promise<
  ContractRouteResponse<(typeof attendanceContract)["markedDates"]>
> {
  const user = request.user as User;
  if (!canReadCollection(user, COLLECTION)) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Insufficient permissions" },
    };
  }
  try {
    const dates = await attendanceUseCases.listMarkedAttendanceDates(query);
    return { status: 200 as const, body: { dates } };
  } catch (error) {
    return handleContractError(request, error, {
      status: 500,
      body: { type: "database_error", message: "Failed to load marked attendance dates" },
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
      ...(query.dateFrom?.trim() ? { dateFrom: query.dateFrom.trim() } : {}),
      ...(query.dateTo?.trim() ? { dateTo: query.dateTo.trim() } : {}),
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

// Setup writes live in their own module (300-line band) and are re-exported here.
export {
  attendanceUpdateFieldConfigHandler,
  attendanceUpdatePreferencesHandler,
} from "./attendanceSetupWriteHandlers.js";
