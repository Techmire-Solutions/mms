/**
 * Restore round-trip for `dashboard_widgets`.
 *
 * Backup payloads carry raw table rows (including the `config` jsonb) and the
 * restore pipeline applies `applyTitleCaseRecursive` to the whole collection
 * before dispatching to `replaceDashboardWidgetsForWorkspace`. These specs pin
 * that a restore keeps the widget's behaviour: enums stay valid and the jsonb
 * remainder is not nested one level deep.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  listDashboardWidgetsByWorkspace,
  replaceDashboardWidgetsForWorkspace,
} from "../db/repositories/dashboardWidgetsRepository.js";

const state: { rows: Array<Record<string, unknown>> } = { rows: [] };

const mockTx = {
  delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
  })),
  insert: vi.fn(() => ({
    values: vi.fn((rows: Array<Record<string, unknown>>) => {
      state.rows = rows;
      return {
        onConflictDoUpdate: vi.fn().mockResolvedValue([]),
      };
    }),
  })),
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => ({
            offset: vi.fn(async () => state.rows),
          })),
        })),
      })),
    })),
  })),
};

vi.mock("../db/tenant-context.js", () => ({
  withTenant: vi.fn((_subdomain: string, cb: (tx: typeof mockTx) => Promise<unknown>) =>
    cb(mockTx),
  ),
  withTenantRead: vi.fn((_subdomain: string, cb: (tx: typeof mockTx) => Promise<unknown>) =>
    cb(mockTx),
  ),
}));

/** Raw row as produced by the pre-fix backup snapshot, after restore title-casing. */
const legacyBackupRow = {
  id: "custom-1",
  workspaceSubdomain: "demo",
  widgetType: "Kpi",
  category: "students",
  collection: "Students",
  role: "admin",
  isPinnedToDashboard: true,
  title: "Active Students",
  icon: "users",
  color: "emerald",
  operation: "Count",
  sortOrder: 2,
  config: {
    titleKey: "dashboard.students",
    chartType: "Bar",
    thresholdCondition: "Lt",
    thresholdValue: 80,
    xAxisField: "createdAt",
  },
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("dashboard widget restore round-trip", () => {
  beforeEach(() => {
    state.rows = [];
    vi.clearAllMocks();
  });

  it("keeps enums valid and the config jsonb flat for a legacy raw-row backup", async () => {
    await replaceDashboardWidgetsForWorkspace("demo", [legacyBackupRow]);

    const [stored] = state.rows;
    expect(stored).toBeDefined();
    // The jsonb remainder must not contain the row itself.
    expect(stored.config).toMatchObject({
      titleKey: "dashboard.students",
      chartType: "bar",
      thresholdCondition: "lt",
      thresholdValue: 80,
      xAxisField: "createdAt",
    });
    expect(stored.config).not.toHaveProperty("config");
    expect(stored.config).not.toHaveProperty("workspaceSubdomain");
    expect(stored.config).not.toHaveProperty("updatedAt");

    const [widget] = await listDashboardWidgetsByWorkspace("demo");
    expect(widget).toMatchObject({
      id: "custom-1",
      title: "Active Students",
      operation: "count",
      collection: "students",
      widgetType: "kpi",
      chartType: "bar",
      thresholdCondition: "lt",
      thresholdValue: 80,
      sortOrder: 2,
      isPinnedToDashboard: true,
    });
    expect(widget).not.toHaveProperty("config");
    expect(widget).not.toHaveProperty("workspaceSubdomain");
    expect(widget).not.toHaveProperty("updatedAt");
  });

  it("round-trips a canonical DTO record unchanged", async () => {
    const canonical = {
      id: "custom-2",
      title: "Outstanding",
      category: "finance",
      collection: "finance_invoices",
      operation: "sum",
      color: "amber",
      isPinnedToDashboard: true,
      widgetType: "chart",
      chartType: "line",
      targetField: "balance",
      sortOrder: 0,
    };

    await replaceDashboardWidgetsForWorkspace("demo", [canonical]);

    const [widget] = await listDashboardWidgetsByWorkspace("demo");
    expect(widget).toEqual(canonical);
  });

  it("deduplicates duplicate ids instead of failing the whole restore", async () => {
    await replaceDashboardWidgetsForWorkspace("demo", [
      { ...legacyBackupRow, id: "dup", title: "First" },
      { ...legacyBackupRow, id: "dup", title: "Second" },
    ]);

    expect(state.rows).toHaveLength(1);
    expect(state.rows[0]?.title).toBe("Second");
  });

  it("keeps restoring the valid widgets when the payload carries corrupt entries", async () => {
    await replaceDashboardWidgetsForWorkspace("demo", [
      null as unknown as Record<string, unknown>,
      legacyBackupRow,
      "not-a-widget" as unknown as Record<string, unknown>,
    ]);

    expect(state.rows).toHaveLength(1);
    expect(state.rows[0]?.id).toBe("custom-1");
  });
});
