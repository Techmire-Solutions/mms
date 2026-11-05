import type { SessionsRepository } from "../repository/sessionsRepository.js";
import { getRequestTenant } from "../../lib/tenantContext.js";
import type {
  Session,
  SessionsListQuery,
  SessionsWidgetQuery,
  SessionsReportAggregates,
} from "@mms/shared";

/**
 * Read-only sessions operations (Work page, counts, metrics, widgets, reports). Split from the
 * write use-cases to keep both modules under the 300-line ceiling.
 */
export function createSessionReadUseCases(repo: SessionsRepository) {
  return {
    loadSessionsPage: async (query: SessionsListQuery & { includeDeleted?: boolean }) => {
      const tenant = getRequestTenant();
      if (!tenant) {
        return {
          sessions: [],
          total: 0,
          page: query.page ?? 1,
          limit: query.limit ?? 12,
          hasMore: false,
        };
      }
      return repo.listSessionsPage(tenant, query);
    },

    loadSessionsByIds: async (ids: string[]): Promise<Session[]> => {
      const tenant = getRequestTenant();
      if (!tenant || ids.length === 0) return [];
      const matched = (await repo.findSessionsByIds(tenant, ids)) as Session[];
      return matched.filter((session) => !session.deletedAt);
    },

    countSessions: async (): Promise<number> => {
      const tenant = getRequestTenant();
      if (!tenant) return 0;
      return repo.countSessionsActive(tenant);
    },

    loadSessionsCommandMetrics: async () => {
      const tenant = getRequestTenant();
      if (!tenant) {
        return {
          total: 0,
          active: 0,
          upcoming: 0,
          completed: 0,
          cancelled: 0,
          totalEnrolled: 0,
          totalCapacity: 0,
          totalClasses: 0,
          sessionsThisWeek: 0,
          sessionsLastWeek: 0,
        };
      }
      return repo.aggregateSessionsCommandMetrics(tenant);
    },

    loadSessionsWidgetAggregates: async (
      queries: SessionsWidgetQuery[],
      _request?: unknown,
    ): Promise<Record<string, import("@mms/shared").SessionsWidgetAggregateResult>> => {
      const tenant = getRequestTenant();
      if (!tenant) return {};
      return repo.aggregateSessionsWidgetQueries(tenant, queries);
    },

    loadSessionsReportAggregates: async (): Promise<SessionsReportAggregates> => {
      const tenant = getRequestTenant();
      if (!tenant) {
        return { capacity: [], enrollmentTrends: [], todaysSessions: [] };
      }
      return repo.loadSessionsReportAggregates(tenant);
    },
  };
}
