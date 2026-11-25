import { describe, expect, it } from "vitest";
import {
  DASHBOARD_ROLE_GREETING_KEYS,
  DASHBOARD_ROLE_BADGE_KEYS,
  resolveDashboardWelcomeSubtitle,
  resolveDashboardRole,
  resolveDefaultDashboardWidgetScope,
  widgetMatchesDashboardRole,
  isDashboardAdminOrAccountant,
  isDashboardFaculty,
  isDashboardAdmin,
  isDashboardAccountant,
} from "@/lib/dashboardRole";

const t = (key: string, params?: Record<string, unknown>) =>
  params ? `${key}:${JSON.stringify(params)}` : key;

const can = (granted: string[]) => (permission: string) => granted.includes(permission);

describe("resolveDashboardWelcomeSubtitle", () => {
  it("faculty with one session uses singular copy", () => {
    expect(
      resolveDashboardWelcomeSubtitle(
        "faculty",
        { activeSessionsCount: 1, activeStudentCount: 0 },
        t,
      ),
    ).toBe("dashboard.sessionsTodayOne");
  });

  it("faculty with multiple sessions uses plural copy with count", () => {
    expect(
      resolveDashboardWelcomeSubtitle(
        "faculty",
        { activeSessionsCount: 3, activeStudentCount: 0 },
        t,
      ),
    ).toBe('dashboard.sessionsToday:{"count":3}');
  });

  it("admin with active students uses overview copy", () => {
    expect(
      resolveDashboardWelcomeSubtitle(
        "admin",
        { activeSessionsCount: 0, activeStudentCount: 5 },
        t,
      ),
    ).toBe('dashboard.overviewActiveStudents:{"count":5}');
  });

  it("accountant uses accountant copy", () => {
    expect(
      resolveDashboardWelcomeSubtitle(
        "accountant",
        { activeSessionsCount: 0, activeStudentCount: 0 },
        t,
      ),
    ).toBe("dashboard.accountantOverview");
  });

  it("falls back to generic overview", () => {
    expect(
      resolveDashboardWelcomeSubtitle(
        "admin",
        { activeSessionsCount: 0, activeStudentCount: 0 },
        t,
      ),
    ).toBe("dashboard.overview");
  });
});

describe("resolveDashboardRole", () => {
  it("returns admin when users write is granted", () => {
    expect(resolveDashboardRole(can(["users.manage"]))).toBe("admin");
  });

  it("returns accountant when only finance write is granted", () => {
    expect(resolveDashboardRole(can(["finance.write"]))).toBe("accountant");
  });

  it("returns faculty when attendance write is granted", () => {
    expect(resolveDashboardRole(can(["attendance.write"]))).toBe("faculty");
  });

  it("defaults to faculty with no grants", () => {
    expect(resolveDashboardRole(can([]))).toBe("faculty");
  });
});

describe("resolveDefaultDashboardWidgetScope", () => {
  it("prefers students scope when students write is granted", () => {
    expect(resolveDefaultDashboardWidgetScope(can(["students.write"]))).toEqual({
      collection: "students",
      category: "students",
    });
  });

  it("uses sessions scope when attendance write is granted", () => {
    expect(resolveDefaultDashboardWidgetScope(can(["attendance.write"]))).toEqual({
      collection: "sessions",
      category: "sessions",
    });
  });

  it("falls back to finance scope", () => {
    expect(resolveDefaultDashboardWidgetScope(can([]))).toEqual({
      collection: "finance_invoices",
      category: "financial",
    });
  });
});

describe("widgetMatchesDashboardRole", () => {
  it("matches the role and defaults to admin", () => {
    expect(widgetMatchesDashboardRole("admin", "admin")).toBe(true);
    expect(widgetMatchesDashboardRole(undefined, "admin")).toBe(true);
    expect(widgetMatchesDashboardRole("faculty", "admin")).toBe(false);
    expect(widgetMatchesDashboardRole("faculty", "faculty")).toBe(true);
    expect(widgetMatchesDashboardRole("accountant", "faculty")).toBe(false);
  });
});

describe("role capability helpers", () => {
  it("isDashboardAdminOrAccountant", () => {
    expect(isDashboardAdminOrAccountant("admin")).toBe(true);
    expect(isDashboardAdminOrAccountant("accountant")).toBe(true);
    expect(isDashboardAdminOrAccountant("faculty")).toBe(false);
  });

  it("isDashboardFaculty / isDashboardAdmin / isDashboardAccountant", () => {
    expect(isDashboardFaculty("faculty")).toBe(true);
    expect(isDashboardFaculty("admin")).toBe(false);
    expect(isDashboardAdmin("admin")).toBe(true);
    expect(isDashboardAccountant("accountant")).toBe(true);
  });
});

describe("dashboard role translation key maps", () => {
  it("maps faculty to canonical faculty greeting and badge keys", () => {
    expect(DASHBOARD_ROLE_GREETING_KEYS.faculty).toBe("dashboard.greeting.faculty");
    expect(DASHBOARD_ROLE_BADGE_KEYS.faculty).toBe("dashboard.badge.faculty");
  });

  it("maps admin and accountant to their respective keys", () => {
    expect(DASHBOARD_ROLE_GREETING_KEYS.admin).toBe("dashboard.greeting.admin");
    expect(DASHBOARD_ROLE_BADGE_KEYS.admin).toBe("dashboard.badge.admin");
    expect(DASHBOARD_ROLE_GREETING_KEYS.accountant).toBe("dashboard.greeting.accountant");
    expect(DASHBOARD_ROLE_BADGE_KEYS.accountant).toBe("dashboard.badge.accountant");
  });
});
