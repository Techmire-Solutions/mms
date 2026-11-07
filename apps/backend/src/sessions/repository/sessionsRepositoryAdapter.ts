import type { SessionsRepository } from "./sessionsRepository.js";
import {
  listSessionsByWorkspace,
  findSessionById,
  findSessionByIdPrimary,
  findSessionsByIds,
  findSessionStatusesByIds,
  findOverlappingSessions,
  saveSession,
  updateSessionDates,
  softDeleteSessionWithCascade,
  restoreSessionWithCascade,
  bulkSoftDeleteSessionsWithCascade,
  bulkRestoreSessionsWithCascade,
} from "../../db/repositories/sessionRepository.js";
import {
  listSessionsPage,
  countSessionsActive,
  aggregateSessionsCommandMetrics,
  bulkUpdateSessionsStatusSql,
} from "../../db/repositories/sessionRepositoryList.js";
import { aggregateSessionsWidgetQueries } from "../../db/repositories/sessionRepositoryWidgets.js";
import { loadSessionsReportAggregatesSql } from "../../db/repositories/sessionRepositoryReport.js";

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
  findOverlappingSessions,
  saveSession,
  updateSessionDates,
  listSessionsPage,
  countSessionsActive,
  aggregateSessionsCommandMetrics,
  bulkUpdateSessionsStatus: bulkUpdateSessionsStatusSql,
  aggregateSessionsWidgetQueries,
  loadSessionsReportAggregates: loadSessionsReportAggregatesSql,
  softDeleteSessionWithCascade,
  restoreSessionWithCascade,
  bulkSoftDeleteSessionsWithCascade,
  bulkRestoreSessionsWithCascade,
};
