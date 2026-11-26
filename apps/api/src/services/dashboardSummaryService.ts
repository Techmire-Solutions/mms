import type {
  StudentsCommandMetricsSnapshot,
  FacultyCommandMetricsSnapshot,
  ContactsCommandMetricsSnapshot,
  SessionsCommandMetricsSnapshot,
  AttendanceCommandMetricsSnapshot,
  FinanceCommandMetricsSnapshot,
  HasanatCommandMetricsSnapshot,
  QuestionBankCommandMetricsSnapshot,
  AccountingCommandMetricsSnapshot,
  TasksCommandMetricsSnapshot,
} from "@mms/contracts";
import { getRequestTenant } from "../lib/tenantContext.js";
import { withTenant } from "@mms/db/context";
import { redisGet, redisSet, redisKeys } from "../lib/redis.js";
import { studentUseCases } from "@mms/mod-students/backend/use-cases";
import { facultyUseCases } from "@mms/mod-faculty/backend/use-cases";
import { contactUseCases } from "@mms/mod-contacts/backend/use-cases";
import { loadSessionsCommandMetrics } from "@mms/mod-sessions/backend/services";
import { aggregateAttendanceCommandMetrics } from "@mms/mod-attendance/backend/repository";
import { loadFinanceCommandMetrics } from "@mms/mod-billing/backend/services";
import { loadHasanatCommandMetrics } from "@mms/mod-hasanat/backend/services";
import { loadAccountingCommandMetrics } from "@mms/mod-accounting/backend/services";
import { loadQuestionBankCommandMetrics } from "@mms/mod-question-bank/backend/services";
import { tasksUseCases } from "@mms/mod-tasks/backend/use-cases";

export interface DashboardSummaryResponse {
  students?: StudentsCommandMetricsSnapshot;
  faculty?: FacultyCommandMetricsSnapshot;
  contacts?: ContactsCommandMetricsSnapshot;
  sessions?: SessionsCommandMetricsSnapshot;
  attendance?: AttendanceCommandMetricsSnapshot;
  finance?: FinanceCommandMetricsSnapshot;
  hasanat?: HasanatCommandMetricsSnapshot;
  questionBank?: QuestionBankCommandMetricsSnapshot;
  accounting?: AccountingCommandMetricsSnapshot;
  tasks?: TasksCommandMetricsSnapshot;
}

/**
 * Aggregates high-frequency command metrics across tenant domains in a single
 * read-only transaction with statement timeout safety. The result is cached in
 * Redis (keyed by tenant + date) for a short TTL so repeated dashboard loads
 * within the window skip the 9-way aggregation. The frontend already treats the
 * summary as fresh for 30s, so a 30s server cache adds no additional visible
 * staleness while cutting redundant aggregation work.
 */
const DASHBOARD_SUMMARY_CACHE_TTL_SECONDS = 30;

/**
 * In-process single-flight for cold loads: concurrent requests for the same
 * tenant+date share one 10-way aggregation instead of each firing its own.
 * Entries are removed as soon as the computation settles, so failures are never
 * cached (the caller sees the real error and the next request retries).
 */
const inFlightSummaries = new Map<string, Promise<DashboardSummaryResponse>>();

export async function loadDashboardSummary(date?: string): Promise<DashboardSummaryResponse> {
  const tenant = getRequestTenant();
  if (!tenant) return {};

  const cleanTenant = tenant.trim().toLowerCase();
  const cacheKey = redisKeys.dashboardSummary(cleanTenant, date);

  const cached = await redisGet(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached) as DashboardSummaryResponse;
    } catch {
      // Corrupt/partial cache entry — recompute below.
    }
  }

  const inFlight = inFlightSummaries.get(cacheKey);
  if (inFlight) return inFlight;

  const computation = computeDashboardSummary(cleanTenant, date, cacheKey);
  inFlightSummaries.set(cacheKey, computation);
  try {
    return await computation;
  } finally {
    inFlightSummaries.delete(cacheKey);
  }
}

async function computeDashboardSummary(
  cleanTenant: string,
  date: string | undefined,
  cacheKey: string,
): Promise<DashboardSummaryResponse> {
  const result = await withTenant(
    cleanTenant,
    async () => {
      const students = await studentUseCases.loadStudentsCommandMetrics();
      const facultyData = await facultyUseCases.loadFacultyCommandMetrics();
      const contacts = await contactUseCases.loadContactsCommandMetrics();
      const sessions = await loadSessionsCommandMetrics();
      const attendance = await aggregateAttendanceCommandMetrics(cleanTenant, {
        selectedDate: date,
      });
      const finance = await loadFinanceCommandMetrics();
      const hasanat = await loadHasanatCommandMetrics();
      const questionBank = await loadQuestionBankCommandMetrics();
      const accounting = await loadAccountingCommandMetrics();
      const tasks = await tasksUseCases.getTaskMetrics(cleanTenant);

      return {
        students,
        faculty: facultyData,
        contacts,
        sessions,
        attendance,
        finance,
        hasanat,
        questionBank,
        accounting,
        tasks,
      };
    },
    { readOnly: true, statementTimeoutMs: 10000 },
  );

  await redisSet(cacheKey, JSON.stringify(result), DASHBOARD_SUMMARY_CACHE_TTL_SECONDS);
  return result;
}
