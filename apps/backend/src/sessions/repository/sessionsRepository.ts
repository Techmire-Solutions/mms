import type {
  Session,
  SessionsListQuery,
  SessionsListPageResult,
  SessionsCommandMetricsSnapshot,
  SessionsWidgetQuery,
  SessionsWidgetAggregateResult,
  SessionsReportAggregates,
} from "@mms/shared";

/**
 * Sole storage gateway for the sessions module.
 *
 * Mirrors the `contacts` reference pattern: routes/use-cases depend on this
 * interface (never on Drizzle directly), and the Drizzle-backed adapter is the
 * only implementation. Tests can inject a fake repository at the seam.
 */
export interface SessionsRepository {
  listSessionsByWorkspace(tenant: string): Promise<Session[]>;
  findSessionById(tenant: string, id: string): Promise<Session | null>;
  findSessionsByIds(tenant: string, ids: string[]): Promise<Session[]>;
  saveSession(tenant: string, record: Session): Promise<void>;
  listSessionsPage(tenant: string, query: SessionsListQuery): Promise<SessionsListPageResult>;
  countSessionsActive(tenant: string): Promise<number>;
  aggregateSessionsCommandMetrics(tenant: string): Promise<SessionsCommandMetricsSnapshot>;
  bulkUpdateSessionsStatus(
    tenant: string,
    ids: string[],
    status: string,
  ): Promise<{ succeeded: number; failed: number }>;
  aggregateSessionsWidgetQueries(
    tenant: string,
    queries: SessionsWidgetQuery[],
  ): Promise<Record<string, SessionsWidgetAggregateResult>>;
  loadSessionsReportAggregates(tenant: string): Promise<SessionsReportAggregates>;
  softDeleteSessionWithCascade(
    tenant: string,
    sessionId: string,
    deletedBy?: string,
    deletionReason?: string,
  ): Promise<boolean>;
  restoreSessionWithCascade(tenant: string, sessionId: string, userId?: string): Promise<boolean>;
  bulkSoftDeleteSessionsWithCascade(
    tenant: string,
    sessionIds: string[],
    deletedBy?: string,
    deletionReason?: string,
  ): Promise<{ succeeded: number; failed: number }>;
  bulkRestoreSessionsWithCascade(
    tenant: string,
    sessionIds: string[],
    userId?: string,
  ): Promise<{ succeeded: number; failed: number }>;
}
