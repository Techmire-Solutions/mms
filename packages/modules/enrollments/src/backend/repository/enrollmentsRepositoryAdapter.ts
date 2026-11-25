import type { EnrollmentsRepository } from "./enrollmentsRepository.js";
import {
  listEnrollmentsByWorkspace,
  findEnrollmentById,
  findEnrollmentsByIds,
  findActiveEnrollmentInSession,
  saveEnrollment,
  transitionEnrollmentStatusTx,
  bulkSoftDeleteEnrollments,
  bulkRestoreEnrollments,
} from "../repository/db/enrollmentRepository.js";
import {
  listEnrollmentsPage,
  countEnrollmentsActive,
  aggregateEnrollmentsCommandMetrics,
} from "../repository/db/enrollmentRepositoryList.js";
import { aggregateEnrollmentsWidgetQueries } from "../repository/db/enrollmentRepositoryWidgets.js";
import { loadEnrollmentsReportAggregatesSql } from "../repository/db/enrollmentRepositoryReport.js";
import { findStudentById } from "../deps.js";
import { findSessionById } from "../deps.js";
import { findWorkspaceTimezone } from "../deps.js";

/**
 * Drizzle-backed adapter for {@link EnrollmentsRepository}. Delegates to the
 * existing concrete repository functions (no SQL rewrite in this pass).
 */
export const enrollmentsRepository: EnrollmentsRepository = {
  listEnrollmentsByWorkspace,
  findEnrollmentById,
  findEnrollmentsByIds,
  findActiveEnrollmentInSession,
  saveEnrollment,
  transitionEnrollmentStatusTx,
  listEnrollmentsPage,
  countEnrollmentsActive,
  aggregateEnrollmentsCommandMetrics,
  aggregateEnrollmentsWidgetQueries,
  loadEnrollmentsReportAggregates: loadEnrollmentsReportAggregatesSql,
  bulkSoftDeleteEnrollments,
  bulkRestoreEnrollments,
  findStudentById,
  findSessionById,
  findWorkspaceTimezone,
};
