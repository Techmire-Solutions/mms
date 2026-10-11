import { sessionsUseCases } from "../sessions/use-cases/sessionsUseCases.js";

/**
 * Thin re-export of the sessions use-cases facade.
 *
 * Kept for backward compatibility with existing importers (report routes, tests).
 * New code should depend on `sessions/use-cases/sessionsUseCases.js` directly.
 */
export const loadSessions = sessionsUseCases.loadSessions;
export const createSession = sessionsUseCases.createSession;
export const updateSessionById = sessionsUseCases.updateSessionById;
export const deleteSessionById = sessionsUseCases.deleteSessionById;
export const restoreSessionById = sessionsUseCases.restoreSessionById;
export const bulkSoftDeleteSessions = sessionsUseCases.bulkSoftDeleteSessions;
export const bulkRestoreSessions = sessionsUseCases.bulkRestoreSessions;
export const bulkUpdateSessionsStatus = sessionsUseCases.bulkUpdateSessionsStatus;
export const loadSessionsPage = sessionsUseCases.loadSessionsPage;
export const loadSessionsByIds = sessionsUseCases.loadSessionsByIds;
export const countSessions = sessionsUseCases.countSessions;
export const loadSessionsCommandMetrics = sessionsUseCases.loadSessionsCommandMetrics;
export const loadSessionsWidgetAggregates = sessionsUseCases.loadSessionsWidgetAggregates;
export const loadSessionsReportAggregates = sessionsUseCases.loadSessionsReportAggregates;
