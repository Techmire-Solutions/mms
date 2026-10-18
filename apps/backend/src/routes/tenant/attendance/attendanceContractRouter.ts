import type { FastifyPluginAsync } from "fastify";
import {
  isQueryFlagTrue,
  type User,
  ATTENDANCE_MODULE_MANIFEST,
  attendanceContract,
  roleHasPermission,
  normalizeAttendanceModulePreferences,
  normalizeAttendanceReportComparisonQuery,
  parseComparisonQueryParams,
  ATTENDANCE_LOOKUP_KINDS,
  type AttendanceLookupKind,
} from "@mms/shared";
import { initServer, type RouterImplementation } from "@ts-rest/fastify";
import { handleContractError } from "../../../lib/contractError.js";
import { standardRequestValidationErrorHandler } from "../../../lib/contractRegistration.js";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import {
  canDeleteCollection,
  canReadCollection,
  canWriteCollection,
} from "../../../services/rbacService.js";
import { withTenant } from "../../../db/tenant-context.js";
import { getRequestTenant } from "../../../lib/tenantContext.js";
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
import { putAttendanceLookupKind } from "./attendanceLookupKindPut.js";
import { assertTeacherClassScope } from "../../../sessions/use-cases/teacherSectionScope.js";
import { assertInstructionalDays } from "../../../attendance/use-cases/instructionalDayGuard.js";

const COLLECTION = ATTENDANCE_MODULE_MANIFEST.collectionKey;
const SETUP_WRITE_PERM = ATTENDANCE_MODULE_MANIFEST.permissions.setupWrite;
const s = initServer();
const auditAttendance = createCollectionAuditHelper("attendance_records");

function getTenantId(request: { tenant?: { id: string } }): string | null {
  return request.tenant?.id || getRequestTenant() || null;
}

export const attendanceContractRouter: FastifyPluginAsync = async (fastify) => {
  const router = s.router(attendanceContract, {
    list: async ({
      query,
      request,
    }: ContractRouteArgs<(typeof attendanceContract)["list"]>): Promise<
      ContractRouteResponse<(typeof attendanceContract)["list"]>
    > => {
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
    },

    create: async ({
      body,
      request,
    }: ContractRouteArgs<(typeof attendanceContract)["create"]>): Promise<
      ContractRouteResponse<(typeof attendanceContract)["create"]>
    > => {
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
    },

    bulk: async ({
      body,
      request,
    }: ContractRouteArgs<(typeof attendanceContract)["bulk"]>): Promise<
      ContractRouteResponse<(typeof attendanceContract)["bulk"]>
    > => {
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
        await assertTeacherClassScope(
          user,
          tenantId,
          body.records.map((r) => ({ classId: r.classId, date: r.date })),
        );
        await assertInstructionalDays(
          tenantId,
          body.records.map((r) => ({ classId: r.classId, studentId: r.studentId, date: r.date })),
          user.id,
        );
        const records = await withTenant(
          tenantId,
          () =>
            attendanceUseCases.upsertAttendanceRecords(
              body.records.map((r) => ({ ...r, markedBy: user.id })),
            ),
          { readOnly: false },
        );
        return { status: 200 as const, body: { records } };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "database_error", message: "Failed to update attendance records" },
        });
      }
    },

    bulkDelete: async ({
      body,
      request,
    }: ContractRouteArgs<(typeof attendanceContract)["bulkDelete"]>): Promise<
      ContractRouteResponse<(typeof attendanceContract)["bulkDelete"]>
    > => {
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
        const result = await withTenant(
          tenantId,
          () =>
            attendanceUseCases.bulkSoftDeleteAttendance(
              body.ids.map(String),
              String(user.id),
              body.deletionReason,
            ),
          { readOnly: false },
        );
        return { status: 200 as const, body: { success: true, ...result } };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "database_error", message: "Failed to bulk delete attendance records" },
        });
      }
    },

    bulkRestore: async ({
      body,
      request,
    }: ContractRouteArgs<(typeof attendanceContract)["bulkRestore"]>): Promise<
      ContractRouteResponse<(typeof attendanceContract)["bulkRestore"]>
    > => {
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
        const result = await withTenant(
          tenantId,
          () => attendanceUseCases.bulkRestoreAttendance(body.ids.map(String), String(user.id)),
          { readOnly: false },
        );
        return { status: 200 as const, body: { success: true, ...result } };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "database_error", message: "Failed to bulk restore attendance records" },
        });
      }
    },

    update: async ({
      params: { id },
      body,
      request,
    }: ContractRouteArgs<(typeof attendanceContract)["update"]>): Promise<
      ContractRouteResponse<(typeof attendanceContract)["update"]>
    > => {
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
      // The URL id is authoritative — reject a mismatched body id rather than
      // updating a different record.
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
            // Moving a record onto another day/class must land on a teaching day.
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
    },

    delete: async ({
      params: { id },
      body,
      request,
    }: ContractRouteArgs<(typeof attendanceContract)["delete"]>): Promise<
      ContractRouteResponse<(typeof attendanceContract)["delete"]>
    > => {
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
    },

    restore: async ({
      params: { id },
      request,
    }: ContractRouteArgs<(typeof attendanceContract)["restore"]>): Promise<
      ContractRouteResponse<(typeof attendanceContract)["restore"]>
    > => {
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
    },

    widgetAggregates: async ({
      body,
      request,
    }: ContractRouteArgs<(typeof attendanceContract)["widgetAggregates"]>): Promise<
      ContractRouteResponse<(typeof attendanceContract)["widgetAggregates"]>
    > => {
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
    },

    reportAggregates: async ({
      query,
      request,
    }: ContractRouteArgs<(typeof attendanceContract)["reportAggregates"]>): Promise<
      ContractRouteResponse<(typeof attendanceContract)["reportAggregates"]>
    > => {
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
    },

    getFieldConfig: async ({
      request,
    }: ContractRouteArgs<(typeof attendanceContract)["getFieldConfig"]>): Promise<
      ContractRouteResponse<(typeof attendanceContract)["getFieldConfig"]>
    > => {
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
    },

    updateFieldConfig: async ({
      body,
      request,
    }: ContractRouteArgs<(typeof attendanceContract)["updateFieldConfig"]>): Promise<
      ContractRouteResponse<(typeof attendanceContract)["updateFieldConfig"]>
    > => {
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
    },

    getPreferences: async ({
      request,
    }: ContractRouteArgs<(typeof attendanceContract)["getPreferences"]>): Promise<
      ContractRouteResponse<(typeof attendanceContract)["getPreferences"]>
    > => {
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
    },

    updatePreferences: async ({
      body,
      request,
    }: ContractRouteArgs<(typeof attendanceContract)["updatePreferences"]>): Promise<
      ContractRouteResponse<(typeof attendanceContract)["updatePreferences"]>
    > => {
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
    },

    getLookups: async ({
      request,
    }: ContractRouteArgs<(typeof attendanceContract)["getLookups"]>): Promise<
      ContractRouteResponse<(typeof attendanceContract)["getLookups"]>
    > => {
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
    },

    getLookupKind: async ({
      params: { kind },
      request,
    }: ContractRouteArgs<(typeof attendanceContract)["getLookupKind"]>): Promise<
      ContractRouteResponse<(typeof attendanceContract)["getLookupKind"]>
    > => {
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
    },

    updateLookupKind: putAttendanceLookupKind,
  } as unknown as RouterImplementation<typeof attendanceContract>);

  await fastify.register(s.plugin(router), {
    requestValidationErrorHandler: standardRequestValidationErrorHandler,
  });
};
