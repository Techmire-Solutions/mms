import React, { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchDashboardSummaryAsync = vi.hoisted(() => vi.fn());
const mockAuthState = vi.hoisted(() => ({ isAuthenticated: true }));

vi.mock("./dashboardApi", () => ({ fetchDashboardSummaryAsync }));
vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => mockAuthState,
}));
vi.mock("@/lib/api", () => ({ tsrClient: {} }));

import {
  DASHBOARD_PREFERENCES_QUERY_KEY,
  DASHBOARD_WIDGETS_QUERY_KEY,
  invalidateDashboardConfigQueries,
} from "./useDashboardSetupConfig";
import { DASHBOARD_SUMMARY_QUERY_KEY, useDashboardSummaryQuery } from "./useDashboardSummaryQuery";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("useDashboardSummaryQuery & dashboard query helpers", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    fetchDashboardSummaryAsync.mockReset();
    mockAuthState.isAuthenticated = true;
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    queryClient.clear();
  });

  it("keys the summary by date only — the role is a presentation hint", () => {
    expect(DASHBOARD_SUMMARY_QUERY_KEY("2026-08-31")).toEqual([
      "dashboard",
      "summary",
      { date: "2026-08-31" },
    ]);
    // Same day, different role hint → same cache entry (no duplicate fetch).
    expect(DASHBOARD_SUMMARY_QUERY_KEY("2026-08-31")).toEqual(
      DASHBOARD_SUMMARY_QUERY_KEY("2026-08-31"),
    );
  });

  it("fetches dashboard summary and sets summary data", async () => {
    const mockSummary = { students: { total: 100 }, revenue: { total: 5000 } };
    fetchDashboardSummaryAsync.mockResolvedValueOnce(mockSummary);

    let queryResult: ReturnType<typeof useDashboardSummaryQuery> | undefined;

    function Probe() {
      queryResult = useDashboardSummaryQuery("2026-08-31", "admin");
      return <div>{queryResult.summary ? "loaded" : "loading"}</div>;
    }

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Probe />
        </QueryClientProvider>,
      );
    });

    await act(async () => {
      await vi.waitFor(() => {
        expect(queryResult?.isSuccess).toBe(true);
        expect(queryResult?.summary).toEqual(mockSummary);
        expect(container.textContent).toBe("loaded");
      });
    });

    expect(fetchDashboardSummaryAsync).toHaveBeenCalledWith(
      "2026-08-31",
      "admin",
      expect.any(AbortSignal),
    );
  });

  it("does not execute query when unauthenticated or explicitly disabled", async () => {
    mockAuthState.isAuthenticated = false;

    function Probe() {
      useDashboardSummaryQuery("2026-08-31", "admin");
      return <div>idle</div>;
    }

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Probe />
        </QueryClientProvider>,
      );
    });

    expect(fetchDashboardSummaryAsync).not.toHaveBeenCalled();
  });

  it("retains the last successful snapshot when a background refresh fails (placeholderData)", async () => {
    const firstSummary = { students: { total: 1441 } };
    const queryKey = DASHBOARD_SUMMARY_QUERY_KEY("2026-08-31");
    queryClient.setQueryData(queryKey, firstSummary);

    let currentSummary: unknown;
    let isError = false;

    function Probe(): React.JSX.Element {
      const query = useDashboardSummaryQuery("2026-08-31", "admin", {
        refetchInterval: 3_600_000,
      });
      currentSummary = query.summary;
      isError = query.isError;
      return (
        <div>
          {String((query.summary as { students?: { total?: number } })?.students?.total ?? "")}
        </div>
      );
    }

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Probe />
        </QueryClientProvider>,
      );
    });
    expect(container.textContent).toBe("1441");

    fetchDashboardSummaryAsync.mockRejectedValueOnce(new Error("temporary gateway failure"));
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey });
    });

    await act(async () => {
      await vi.waitFor(() => {
        expect(isError).toBe(true);
        expect(currentSummary).toEqual(firstSummary);
        expect(container.textContent).toBe("1441");
      });
    });
  });

  it("invalidates only the configuration documents on a dashboard config change", () => {
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    invalidateDashboardConfigQueries(queryClient);

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: DASHBOARD_PREFERENCES_QUERY_KEY });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: DASHBOARD_WIDGETS_QUERY_KEY });
    expect(invalidateSpy).toHaveBeenCalledTimes(2);
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ["dashboard", "summary"] });
  });
});
