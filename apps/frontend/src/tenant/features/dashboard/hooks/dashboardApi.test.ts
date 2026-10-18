import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  fetchDashboardPreferences,
  saveDashboardPreferencesAsync,
  fetchDashboardWidgets,
  saveDashboardWidgetsAsync,
  deleteDashboardWidgetAsync,
  reorderDashboardWidgetsAsync,
  fetchDashboardSummaryAsync,
} from "./dashboardApi";

const mockApiContract = vi.hoisted(() => ({
  dashboard: {
    getPreferences: vi.fn(),
    putPreferences: vi.fn(),
    getWidgets: vi.fn(),
    putWidgets: vi.fn(),
    deleteWidget: vi.fn(),
    reorderWidgets: vi.fn(),
    getSummary: vi.fn(),
  },
}));

vi.mock("@/lib/api", () => ({
  apiContract: mockApiContract,
}));

describe("dashboardApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetchDashboardPreferences calls GET /api/dashboard/preferences", async () => {
    mockApiContract.dashboard.getPreferences.mockResolvedValueOnce({
      status: 200,
      body: { preferences: { disabledCardIds: [], gridMode: "comfortable" } },
    });

    const res = await fetchDashboardPreferences();
    expect(mockApiContract.dashboard.getPreferences).toHaveBeenCalledWith({ query: {} });
    expect(res?.gridMode).toBe("comfortable");
  });

  it("saveDashboardPreferencesAsync calls PUT /api/dashboard/preferences", async () => {
    mockApiContract.dashboard.putPreferences.mockResolvedValueOnce({
      status: 200,
      body: { preferences: { disabledCardIds: ["c1"], gridMode: "compact" } },
    });

    const res = await saveDashboardPreferencesAsync({ gridMode: "compact" });
    expect(mockApiContract.dashboard.putPreferences).toHaveBeenCalledWith({
      body: { gridMode: "compact" },
    });
    expect(res.gridMode).toBe("compact");
  });

  it("fetchDashboardWidgets calls GET /api/dashboard/widgets", async () => {
    mockApiContract.dashboard.getWidgets.mockResolvedValueOnce({
      status: 200,
      body: { widgets: [{ id: "w1" }] },
    });

    const res = await fetchDashboardWidgets();
    expect(mockApiContract.dashboard.getWidgets).toHaveBeenCalledWith({ query: {} });
    expect(res).toEqual([{ id: "w1" }]);
  });

  it("saveDashboardWidgetsAsync calls PUT /api/dashboard/widgets", async () => {
    const sampleWidget = {
      id: "w1",
      title: "Total Students",
      category: "students",
      collection: "students",
      operation: "count" as const,
      color: "emerald",
      isPinnedToDashboard: true,
    };
    mockApiContract.dashboard.putWidgets.mockResolvedValueOnce({
      status: 200,
      body: { widgets: [sampleWidget] },
    });

    const res = await saveDashboardWidgetsAsync([sampleWidget]);
    expect(mockApiContract.dashboard.putWidgets).toHaveBeenCalledWith({
      body: [sampleWidget],
    });
    expect(res).toEqual([sampleWidget]);
  });

  it("deleteDashboardWidgetAsync calls DELETE /api/dashboard/widgets/:id", async () => {
    mockApiContract.dashboard.deleteWidget.mockResolvedValueOnce({
      status: 200,
      body: { success: true },
    });

    await deleteDashboardWidgetAsync("w1");
    expect(mockApiContract.dashboard.deleteWidget).toHaveBeenCalledWith({
      params: { id: "w1" },
      body: {},
    });
  });

  it("reorderDashboardWidgetsAsync calls PUT /api/dashboard/widgets/reorder", async () => {
    mockApiContract.dashboard.reorderWidgets.mockResolvedValueOnce({
      status: 200,
      body: { success: true },
    });

    const order = [
      { id: "w1", sortOrder: 0 },
      { id: "w2", sortOrder: 1 },
    ];
    await reorderDashboardWidgetsAsync(order);
    expect(mockApiContract.dashboard.reorderWidgets).toHaveBeenCalledWith({
      body: { order },
    });
  });

  it("fetchDashboardSummaryAsync calls GET /api/dashboard/summary", async () => {
    const controller = new AbortController();
    mockApiContract.dashboard.getSummary.mockResolvedValueOnce({
      status: 200,
      body: { summary: { students: { total: 100 } } },
    });

    const res = await fetchDashboardSummaryAsync("2026-08-27", "admin", controller.signal);
    expect(mockApiContract.dashboard.getSummary).toHaveBeenCalledWith({
      query: { date: "2026-08-27", role: "admin" },
      fetchOptions: { signal: controller.signal },
    });
    expect(res).toEqual({ students: { total: 100 } });
  });

  it("fetchDashboardSummaryAsync rejects non-success responses", async () => {
    mockApiContract.dashboard.getSummary.mockResolvedValueOnce({
      status: 502,
      body: { type: "bad_gateway", message: "Dashboard backend unavailable" },
    });

    await expect(fetchDashboardSummaryAsync("2026-08-27", "admin")).rejects.toMatchObject({
      status: 502,
      type: "bad_gateway",
      message: "Dashboard backend unavailable",
    });
  });
});
