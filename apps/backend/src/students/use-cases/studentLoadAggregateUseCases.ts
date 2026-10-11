import type {
  StudentsCommandMetricsSnapshot,
  StudentsWidgetAggregateResult,
  StudentsWidgetQuery,
} from "@mms/shared";
import { getRequestTenant } from "../../lib/tenantContext.js";
import type { StudentsRepository } from "../repository/studentsRepository.js";
import { studentsRepository } from "../repository/studentsRepositoryAdapter.js";

export async function loadStudentsCommandMetrics(
  repo: StudentsRepository = studentsRepository,
): Promise<StudentsCommandMetricsSnapshot> {
  const tenant = getRequestTenant();
  if (!tenant) {
    return {
      total: 0,
      active: 0,
      inactive: 0,
      suspended: 0,
      newThisPeriod: 0,
    };
  }
  return repo.aggregateCommandMetrics(tenant);
}

export async function loadStudentsWidgetAggregates(
  queries: StudentsWidgetQuery[],
  repo: StudentsRepository = studentsRepository,
): Promise<Record<string, StudentsWidgetAggregateResult>> {
  const tenant = getRequestTenant();
  if (!tenant) return {};
  return repo.aggregateWidgetQueries(tenant, queries);
}
