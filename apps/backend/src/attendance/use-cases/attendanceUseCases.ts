import type { FastifyRequest } from "fastify";
import type { AttendanceRepository } from "../repository/attendanceRepository.js";
import { attendanceRepository } from "../repository/attendanceRepositoryAdapter.js";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { createGenericRelationalService } from "../../services/genericRelationalService.js";
import { defineTenantBulkCollectionService } from "../../services/tenantBulkService.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { stampAttendanceSections } from "./attendanceSectionStamp.js";
import {
  attendanceRecordSchema,
  attendanceListSchema,
  dedupeTrimmedIds,
  EMPTY_ATTENDANCE_REPORT_AGGREGATES,
  normalizeAttendanceReportComparisonQuery,
  type AttendanceCommandMetricsSnapshot,
  type AttendanceRecord,
  type AttendanceRecordInsert,
  type AttendanceRecordUpdate,
  type AttendanceMarkedDatesQuery,
  type AttendanceReportAggregatesQuery,
  type AttendanceListQuery,
} from "@mms/shared";

import {
  createAttendanceForeignKeyValidators,
  type AttendanceUseCasesDependencies,
} from "./attendanceForeignKeyValidation.js";
import { EMPTY_ATTENDANCE_METRICS } from "./attendanceMetricsDefaults.js";

export type { AttendanceUseCasesDependencies };

/**
 * Attendance use-cases — composition root binding an {@link AttendanceRepository}
 * to every operation. Production uses the default Drizzle-backed
 * `attendanceUseCases`; tests can pass a fake repository to exercise
 * orchestration in isolation.
 */
export function createAttendanceUseCases(
  repo: AttendanceRepository = attendanceRepository,
  deps?: AttendanceUseCasesDependencies,
) {
  const crud = createGenericRelationalService<AttendanceRecord>({
    repo: {
      listByWorkspace: repo.listAttendanceRecordsByWorkspace,
      findById: repo.findAttendanceRecordById,
      save: repo.saveAttendanceRecord,
      bulkDelete: repo.bulkSoftDeleteAttendanceRecords,
      bulkRestore: repo.bulkRestoreAttendanceRecords,
    },
    schema: attendanceRecordSchema,
    websocketCollection: "attendance_records",
    idPrefix: "att",
  });

  const bulkService = defineTenantBulkCollectionService<AttendanceRecord>(
    {
      listByWorkspace: repo.listAttendanceRecordsByWorkspace,
      replaceForWorkspace: repo.replaceAttendanceRecordsForWorkspace,
    },
    attendanceListSchema,
    "attendance_records",
  );

  const { validateActiveForeignKeys, validateBatchActiveForeignKeys } =
    createAttendanceForeignKeyValidators(deps);

  return {
    loadAttendanceRecords: crud.loadAll,
    createAttendanceRecord: async (
      record: AttendanceRecordInsert | AttendanceRecord,
    ): Promise<AttendanceRecord> => {
      const tenant = getRequestTenant();
      if (!tenant) throw new Error("Tenant context required");
      await validateActiveForeignKeys(tenant, record);
      const [stamped] = await stampAttendanceSections(tenant, [record]);
      return crud.create(stamped as AttendanceRecord);
    },
    updateAttendanceRecordById: async (
      id: string,
      record: AttendanceRecordUpdate | Partial<AttendanceRecord>,
    ): Promise<AttendanceRecord | null> => {
      const tenant = getRequestTenant();
      if (!tenant) throw new Error("Tenant context required");
      await validateActiveForeignKeys(tenant, record);
      // Section is server-owned: re-stamped only when the row's class/student are known.
      const { sectionId: _clientSection, ...rest } = record as Partial<AttendanceRecord>;
      const next =
        rest.classId && rest.studentId ? (await stampAttendanceSections(tenant, [rest]))[0] : rest;
      return crud.updateById(id, next as AttendanceRecord);
    },
    deleteAttendanceRecordById: crud.deleteById,
    restoreAttendanceRecordById: crud.restoreById,
    bulkSoftDeleteAttendance: crud.bulkDeleteByIds,
    bulkRestoreAttendance: crud.bulkRestoreByIds,

    /** Replace full attendance collection (mark-attendance batch save). */
    replaceAttendanceRecords: bulkService.replace,

    /** Upserts only the supplied attendance records without removing unrelated rows. */
    upsertAttendanceRecords: async (
      records: (AttendanceRecordInsert | AttendanceRecord)[],
    ): Promise<AttendanceRecord[]> => {
      const tenant = getRequestTenant();
      if (!tenant) throw new Error("Tenant context required");
      const validated = attendanceListSchema.parse(records);
      await validateBatchActiveForeignKeys(tenant, validated);
      const parsed = await stampAttendanceSections(tenant, validated);
      await repo.bulkSaveAttendanceRecords(tenant, parsed);
      await broadcastCollection("attendance_records");
      return parsed;
    },

    loadAttendanceRecordById: async (
      id: string,
      includeDeleted = false,
    ): Promise<AttendanceRecord | null> => {
      const tenant = getRequestTenant();
      if (!tenant) return null;
      const cleanId = id?.trim();
      if (!cleanId) return null;
      const record = await repo.findAttendanceRecordById(tenant, cleanId);
      if (!record) return null;
      if (!includeDeleted && record.deletedAt) return null;
      return record;
    },

    loadAttendanceRecordsByIds: async (
      ids: string[],
      includeDeleted = false,
    ): Promise<AttendanceRecord[]> => {
      const tenant = getRequestTenant();
      if (!tenant) return [];
      const cleanIds = dedupeTrimmedIds(ids);
      if (cleanIds.length === 0) return [];
      const records = await repo.findAttendanceRecordsByIds(tenant, cleanIds);
      if (includeDeleted) return records;
      return records.filter((r) => !r.deletedAt);
    },

    loadAttendancePage: async (query: AttendanceListQuery & { includeDeleted?: boolean }) => {
      const tenant = getRequestTenant();
      if (!tenant) {
        return {
          records: [],
          total: 0,
          page: query.page ?? 1,
          limit: query.limit ?? 15,
          hasMore: false,
        };
      }
      return repo.listAttendancePage(tenant, query);
    },

    countAttendanceRecords: async (): Promise<number> => {
      const tenant = getRequestTenant();
      if (!tenant) return 0;
      return repo.countAttendanceActiveByWorkspace(tenant);
    },

    loadAttendanceReportAggregates: async (query?: AttendanceReportAggregatesQuery) => {
      const tenant = getRequestTenant();
      if (!tenant) {
        return EMPTY_ATTENDANCE_REPORT_AGGREGATES;
      }
      const comparison = normalizeAttendanceReportComparisonQuery(query);
      const classId = query?.classId?.trim();
      return repo.loadAttendanceReportAggregates(tenant, {
        ...comparison,
        ...(classId ? { classId } : {}),
      });
    },

    listMarkedAttendanceDates: async (query: AttendanceMarkedDatesQuery): Promise<string[]> => {
      const tenant = getRequestTenant();
      if (!tenant) return [];
      return repo.listMarkedAttendanceDates(tenant, query);
    },

    loadAttendanceCommandMetrics: async (
      request?: FastifyRequest,
    ): Promise<AttendanceCommandMetricsSnapshot> => {
      const tenant = getRequestTenant();
      if (!tenant) return EMPTY_ATTENDANCE_METRICS;
      const dateParam = (request?.query as { date?: string } | undefined)?.date;
      const selectedDate =
        typeof dateParam === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
          ? dateParam
          : undefined;
      return repo.aggregateAttendanceCommandMetrics(tenant, { selectedDate });
    },

    loadAttendanceWidgetAggregates: async (
      queries: import("@mms/shared").WidgetQuery[],
    ): Promise<Record<string, import("@mms/shared").WidgetAggregateResult>> => {
      const tenant = getRequestTenant();
      if (!tenant) return {};
      return repo.aggregateAttendanceWidgetQueries(tenant, queries);
    },
  };
}

export const attendanceUseCases = createAttendanceUseCases();
