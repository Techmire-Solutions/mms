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
} from "@mms/shared";
import { getRequestTenant } from "../lib/tenantContext.js";
import { withTenant } from "../db/tenant-context.js";
import { redisGet, redisSet, redisKeys } from "../lib/redis.js";
import { studentUseCases } from "../students/use-cases/studentUseCases.js";
import { facultyUseCases } from "../faculty/use-cases/facultyUseCases.js";
import { contactUseCases } from "../contacts/use-cases/contactUseCases.js";
import { loadSessionsCommandMetrics } from "./sessionService.js";
import { aggregateAttendanceCommandMetrics } from "../db/repositories/attendanceRepositoryList.js";
import { loadFinanceCommandMetrics } from "./financeService.js";
import { loadHasanatCommandMetrics } from "./hasanatService.js";
import { loadAccountingCommandMetrics } from "./accountingService.js";
import { loadQuestionBankCommandMetrics } from "./questionBankMetricsService.js";
import { tasksUseCases } from "../tasks/use-cases/tasksUseCases.js";

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
