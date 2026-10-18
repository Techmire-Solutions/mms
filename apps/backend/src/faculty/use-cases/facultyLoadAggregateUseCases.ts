import type {
  FacultyCommandMetricsSnapshot,
  FacultyWidgetAggregateResult,
  FacultyWidgetQuery,
} from "@mms/shared";
import { getRequestTenant } from "../../lib/tenantContext.js";
import type { FacultyRepository } from "../repository/facultyRepository.js";
import { facultyRepository } from "../repository/facultyRepositoryAdapter.js";

export async function loadFacultyCommandMetrics(
  repo: FacultyRepository = facultyRepository,
): Promise<FacultyCommandMetricsSnapshot> {
  const tenant = getRequestTenant();
  if (!tenant) {
    return {
      total: 0,
      active: 0,
      inactive: 0,
      onLeave: 0,
      other: 0,
      newThisPeriod: 0,
    };
  }
  return repo.aggregateCommandMetrics(tenant);
}

export async function loadFacultyWidgetAggregates(
  queries: FacultyWidgetQuery[],
  repo: FacultyRepository = facultyRepository,
): Promise<Record<string, FacultyWidgetAggregateResult>> {
  const tenant = getRequestTenant();
  if (!tenant) return {};
  return repo.aggregateWidgetQueries(tenant, queries);
}
