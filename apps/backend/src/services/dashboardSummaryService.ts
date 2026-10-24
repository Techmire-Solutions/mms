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

export async function loadDashboardSummary(
  date?: string,
  _role?: string,
): Promise<DashboardSummaryResponse> {
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
      };
    },
    { readOnly: true, statementTimeoutMs: 10000 },
  );

  await redisSet(cacheKey, JSON.stringify(result), DASHBOARD_SUMMARY_CACHE_TTL_SECONDS);
  return result;
}
