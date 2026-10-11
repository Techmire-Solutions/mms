import type { EnrollmentsRepository } from "./enrollmentsRepository.js";
import {
  listEnrollmentsByWorkspace,
  findEnrollmentById,
  findEnrollmentsByIds,
  saveEnrollment,
  bulkSoftDeleteEnrollments,
  bulkRestoreEnrollments,
} from "../../db/repositories/enrollmentRepository.js";
import {
  listEnrollmentsPage,
  countEnrollmentsActive,
  aggregateEnrollmentsCommandMetrics,
} from "../../db/repositories/enrollmentRepositoryList.js";
import { aggregateEnrollmentsWidgetQueries } from "../../db/repositories/enrollmentRepositoryWidgets.js";
import { loadEnrollmentsReportAggregatesSql } from "../../db/repositories/enrollmentRepositoryReport.js";

/**
 * Drizzle-backed adapter for {@link EnrollmentsRepository}. Delegates to the
 * existing concrete repository functions (no SQL rewrite in this pass).
 */
export const enrollmentsRepository: EnrollmentsRepository = {
  listEnrollmentsByWorkspace,
  findEnrollmentById,
  findEnrollmentsByIds,
  saveEnrollment,
  listEnrollmentsPage,
  countEnrollmentsActive,
  aggregateEnrollmentsCommandMetrics,
  aggregateEnrollmentsWidgetQueries,
  loadEnrollmentsReportAggregates: loadEnrollmentsReportAggregatesSql,
  bulkSoftDeleteEnrollments,
  bulkRestoreEnrollments,
};
