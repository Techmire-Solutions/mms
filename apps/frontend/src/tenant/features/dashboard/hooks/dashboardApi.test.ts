import { describe, expect, it, vi, beforeEach } from "vitest";
import { fetchDashboardSummaryAsync } from "./dashboardApi";

const mockApiContract = vi.hoisted(() => ({
  dashboard: {
    getSummary: vi.fn(),
  },
}));

vi.mock("@/lib/api", () => ({
  apiContract: mockApiContract,
}));

describe("dashboardApi (summary reader)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
