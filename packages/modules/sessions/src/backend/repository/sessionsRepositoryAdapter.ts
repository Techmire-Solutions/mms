import type { SessionsRepository } from "./sessionsRepository.js";
import {
  listSessionsByWorkspace,
  findSessionById,
  findSessionByIdPrimary,
  findSessionsByIds,
  findSessionStatusesByIds,
  sessionHasEnrollments,
  findOverlappingSessions,
  saveSession,
  updateSessionDates,
  softDeleteSessionWithCascade,
  restoreSessionWithCascade,
  bulkSoftDeleteSessionsWithCascade,
  bulkRestoreSessionsWithCascade,
} from "../repository/db/sessionRepository.js";
import {
  listSessionsPage,
  countSessionsActive,
  aggregateSessionsCommandMetrics,
} from "../repository/db/sessionRepositoryList.js";
import { aggregateSessionsWidgetQueries } from "../repository/db/sessionRepositoryWidgets.js";
import { loadSessionsReportAggregatesSql } from "../repository/db/sessionRepositoryReport.js";

/**
 * Drizzle-backed adapter for {@link SessionsRepository}. Delegates to the
 * existing concrete repository functions (no SQL rewrite in this pass).
 */
export const sessionsRepository: SessionsRepository = {
  listSessionsByWorkspace,
  findSessionById,
  findSessionByIdPrimary,
  findSessionsByIds,
  findSessionStatusesByIds,
  sessionHasEnrollments,
  findOverlappingSessions,
  saveSession,
  updateSessionDates,
  listSessionsPage,
  countSessionsActive,
  aggregateSessionsCommandMetrics,
  aggregateSessionsWidgetQueries,
  loadSessionsReportAggregates: loadSessionsReportAggregatesSql,
  softDeleteSessionWithCascade,
  restoreSessionWithCascade,
  bulkSoftDeleteSessionsWithCascade,
  bulkRestoreSessionsWithCascade,
};
