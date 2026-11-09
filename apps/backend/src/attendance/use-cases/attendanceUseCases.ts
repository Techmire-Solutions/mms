import type { AttendanceRepository } from "../repository/attendanceRepository.js";
import { attendanceRepository } from "../repository/attendanceRepositoryAdapter.js";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { createGenericRelationalService } from "../../services/genericRelationalService.js";
import {
  attendanceRecordSchema,
  dedupeTrimmedIds,
  EMPTY_ATTENDANCE_REPORT_AGGREGATES,
  normalizeAttendanceReportComparisonQuery,
  type AttendanceCommandMetricsSnapshot,
  type AttendanceRecord,
  type AttendanceMarkedDatesQuery,
  type AttendanceReportAggregatesQuery,
  type AttendanceListQuery,
} from "@mms/shared";

import {
  createAttendanceForeignKeyValidators,
  type AttendanceUseCasesDependencies,
  type AttendanceReferenceLookups,
} from "./attendanceForeignKeyValidation.js";
import * as attendanceReferences from "../repository/attendanceReferenceRepository.js";
import { EMPTY_ATTENDANCE_METRICS } from "./attendanceMetricsDefaults.js";
import { createAttendanceMutationUseCases } from "./attendanceMutationUseCases.js";

export type { AttendanceUseCasesDependencies };

/**
 * Attendance use-cases — composition root binding an {@link AttendanceRepository}
 * to every operation.
 *
 * Writes own their transaction and run **all** domain rules inside it (teacher row-scope,
 * instructional days, write policy, audit), so an HTTP route, a queued import job and a script get
 * identical decisions. Reads stay on the request tenant like every other module.
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

  // Composition root: bind the Drizzle-backed lookups here, override with test doubles.
  const references: AttendanceReferenceLookups = {
    findStudentById: deps?.findStudentById ?? attendanceReferences.findStudentById,
    findSessionById: deps?.findSessionById ?? attendanceReferences.findSessionById,
    findStudentsByIds: deps?.findStudentsByIds ?? attendanceReferences.findStudentsByIds,
    findSessionsByIds: deps?.findSessionsByIds ?? attendanceReferences.findSessionsByIds,
  };
  const { validateActiveForeignKeys, validateBatchActiveForeignKeys } =
    createAttendanceForeignKeyValidators(references);

  const mutations = createAttendanceMutationUseCases({
    repo,
    crud,
    policyStore: deps?.policyStore,
    validateActiveForeignKeys,
    validateBatchActiveForeignKeys,
  });

  return {
    loadAttendanceRecords: crud.loadAll,

    ...mutations,

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
      return records.filter((record) => !record.deletedAt);
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

    /**
     * Marking matrix: every live mark for one class/section on one day.
     *
     * Separate from `loadAttendancePage` because the grid must not page: a truncated view would be
     * rendered as unmarked defaults and saved back over real absences.
     */
    loadAttendanceRoster: async (query: {
      classId: string;
      date: string;
      sectionId?: string;
    }): Promise<AttendanceRecord[]> => {
      const tenant = getRequestTenant();
      if (!tenant) return [];
      return repo.listAttendanceRoster(tenant, query);
    },

    countAttendanceRecords: async (): Promise<number> => {
      const tenant = getRequestTenant();
      if (!tenant) return 0;
      return repo.countAttendanceActiveByWorkspace(tenant);
    },

    loadAttendanceReportAggregates: async (query?: AttendanceReportAggregatesQuery) => {
      const tenant = getRequestTenant();
      if (!tenant) return EMPTY_ATTENDANCE_REPORT_AGGREGATES;
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

    /**
     * Command-centre metrics for a selected day.
     *
     * Takes the already-parsed day, not a Fastify request: the transport layer owns query parsing,
     * and the metrics cache key can therefore include the date (it previously served another day's
     * numbers for the cache TTL).
     */
    loadAttendanceCommandMetrics: async (
      selectedDate?: string,
    ): Promise<AttendanceCommandMetricsSnapshot> => {
      const tenant = getRequestTenant();
      if (!tenant) return EMPTY_ATTENDANCE_METRICS;
      const day =
        typeof selectedDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)
          ? selectedDate
          : undefined;
      return repo.aggregateAttendanceCommandMetrics(tenant, { selectedDate: day });
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
