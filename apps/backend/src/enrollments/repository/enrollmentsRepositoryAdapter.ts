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
} from "../../db/repositories/enrollmentRepository.js";
import {
  listEnrollmentsPage,
  countEnrollmentsActive,
  aggregateEnrollmentsCommandMetrics,
} from "../../db/repositories/enrollmentRepositoryList.js";
import { aggregateEnrollmentsWidgetQueries } from "../../db/repositories/enrollmentRepositoryWidgets.js";
import { loadEnrollmentsReportAggregatesSql } from "../../db/repositories/enrollmentRepositoryReport.js";
import { findStudentById } from "../../db/repositories/studentRepositoryHydrate.js";
import { findSessionById } from "../../db/repositories/sessionRepositoryHydrate.js";
import { findWorkspaceTimezone } from "../../db/repositories/workspaceRepository.js";

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
