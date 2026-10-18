import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRequestTenant: vi.fn(),
  withTenant: vi.fn(),
  students: vi.fn(),
  faculty: vi.fn(),
  contacts: vi.fn(),
  sessions: vi.fn(),
  attendance: vi.fn(),
  finance: vi.fn(),
  hasanat: vi.fn(),
  questionBank: vi.fn(),
  accounting: vi.fn(),
}));

vi.mock("../lib/tenantContext.js", () => ({
  getRequestTenant: mocks.getRequestTenant,
}));
vi.mock("../db/tenant-context.js", () => ({
  withTenant: mocks.withTenant,
}));
vi.mock("../students/use-cases/studentUseCases.js", () => ({
  studentUseCases: { loadStudentsCommandMetrics: mocks.students },
}));
vi.mock("../faculty/use-cases/facultyUseCases.js", () => ({
  facultyUseCases: {
    loadFacultyCommandMetrics: mocks.faculty,
  },
}));
vi.mock("../contacts/use-cases/contactUseCases.js", () => ({
  contactUseCases: { loadContactsCommandMetrics: mocks.contacts },
}));
vi.mock("../services/sessionService.js", () => ({
  loadSessionsCommandMetrics: mocks.sessions,
}));
vi.mock("../db/repositories/attendanceRepositoryList.js", () => ({
  aggregateAttendanceCommandMetrics: mocks.attendance,
}));
vi.mock("../services/financeService.js", () => ({
  loadFinanceCommandMetrics: mocks.finance,
}));
vi.mock("../services/hasanatService.js", () => ({
  loadHasanatCommandMetrics: mocks.hasanat,
}));
vi.mock("../services/questionBankMetricsService.js", () => ({
  loadQuestionBankCommandMetrics: mocks.questionBank,
}));
vi.mock("../services/accountingService.js", () => ({
  loadAccountingCommandMetrics: mocks.accounting,
}));

import { loadDashboardSummary } from "../services/dashboardSummaryService.js";
import { clearInMemoryRedisFallback } from "../lib/redis.js";

describe("loadDashboardSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearInMemoryRedisFallback();
    mocks.getRequestTenant.mockReturnValue(" DarulQuran ");
    mocks.withTenant.mockImplementation(async (_tenant: string, action: () => Promise<unknown>) =>
      action(),
    );
    mocks.students.mockResolvedValue({ total: 1441 });
    mocks.faculty.mockResolvedValue({ total: 60 });
    mocks.contacts.mockResolvedValue({ total: 1543 });
    mocks.sessions.mockResolvedValue({ total: 8 });
    mocks.attendance.mockResolvedValue({ selectedDatePresentRate: 95 });
    mocks.finance.mockResolvedValue({ paid: 10 });
    mocks.hasanat.mockResolvedValue({ totalPoints: 100 });
    mocks.questionBank.mockResolvedValue({ questions: 20 });
    mocks.accounting.mockResolvedValue({ revenue: 500 });
  });

  it("returns one complete tenant snapshot", async () => {
    const summary = await loadDashboardSummary("2026-08-31", "admin");

    expect(summary.students).toEqual({ total: 1441 });
    expect(summary.faculty).toEqual({ total: 60 });
    expect(summary.contacts).toEqual({ total: 1543 });
    expect(mocks.attendance).toHaveBeenCalledWith("darulquran", {
      selectedDate: "2026-08-31",
    });
    expect(mocks.withTenant).toHaveBeenCalledWith("darulquran", expect.any(Function), {
      readOnly: true,
      statementTimeoutMs: 10000,
    });
  });

  it("rejects the snapshot if any metric fails instead of returning partial zeros", async () => {
    mocks.contacts.mockRejectedValueOnce(new Error("contacts query failed"));

    await expect(loadDashboardSummary("2026-08-31", "admin")).rejects.toThrow(
      "contacts query failed",
    );
  });
});
