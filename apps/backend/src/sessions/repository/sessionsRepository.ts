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
export interface SessionOverlapQuery {
  startDate?: string | null;
  endDate?: string | null;
  excludeId?: string;
}

export interface OverlappingSession {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
}

export interface SessionsRepository {
  listSessionsByWorkspace(tenant: string): Promise<Session[]>;
  findSessionById(tenant: string, id: string): Promise<Session | null>;
  /** Primary read for control flow that must see its own writes (rollover retries). */
  findSessionByIdPrimary(tenant: string, id: string): Promise<Session | null>;
  findSessionsByIds(tenant: string, ids: string[]): Promise<Session[]>;
  /** Stored status per id (one query) for bulk lifecycle transitions. */
  findSessionStatusesByIds(tenant: string, ids: string[]): Promise<Map<string, string>>;
  /** Live sessions whose inclusive date range intersects the requested one (overlap guard). */
  findOverlappingSessions(
    tenant: string,
    input: SessionOverlapQuery,
  ): Promise<OverlappingSession[]>;
  /**
   * `expectedVersion` is the monotonic OCC token the caller read; `expectedUpdatedAt` is the
   * legacy token, still accepted for one release. A mismatch throws `ConflictError`.
   */
  saveSession(
    tenant: string,
    record: Session,
    options?: { expectedUpdatedAt?: string; expectedVersion?: number },
  ): Promise<string>;
  /** Targeted start/end update used by postpone (keeps the aggregate untouched). */
  updateSessionDates(
    tenant: string,
    id: string,
    dates: { startDate: string | null; endDate: string | null },
    options?: { expectedUpdatedAt?: string; expectedVersion?: number },
  ): Promise<boolean>;
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
