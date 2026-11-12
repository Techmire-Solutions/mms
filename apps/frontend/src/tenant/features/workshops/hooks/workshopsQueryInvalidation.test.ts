import { describe, expect, it, vi } from "vitest";
import { DASHBOARD_SUMMARY_QUERY_KEY_ROOT } from "@/lib/query/dashboardQueryKeys";
import { DYNAMIC_WIDGET_AGGREGATES_QUERY_KEY } from "@/lib/query/dynamicWidgetAggregatesQueryKey";
import {
  invalidateWorkshopActivityQueries,
  invalidateWorkshopPreferenceQueries,
  invalidateWorkshopRosterQueries,
  invalidateWorkshopsQueries,
} from "./useWorkshopsApi";

function queryClient() {
  const invalidateQueries = vi.fn().mockResolvedValue(undefined);
  return { invalidateQueries, client: { invalidateQueries } as never };
}

const keys = (invalidateQueries: ReturnType<typeof vi.fn>) =>
  invalidateQueries.mock.calls.map((call) => call[0].queryKey);

describe("workshop query invalidation policy", () => {
  it("refreshes the module and cross-module dashboard/widget aggregates", async () => {
    const { invalidateQueries, client } = queryClient();
    await invalidateWorkshopsQueries(client);
    expect(keys(invalidateQueries)).toEqual(
      expect.arrayContaining([
        ["workshops"],
        DASHBOARD_SUMMARY_QUERY_KEY_ROOT,
        DYNAMIC_WIDGET_AGGREGATES_QUERY_KEY,
      ]),
    );
  });

  it("refreshes seat counters, roster, completion and report for participant changes", async () => {
    const { invalidateQueries, client } = queryClient();
    await invalidateWorkshopRosterQueries(client, "w1");
    const queried = keys(invalidateQueries);
    expect(queried).toEqual(
      expect.arrayContaining([
        ["workshops", "list"],
        ["workshops", "metrics"],
        ["workshops", "detail", "w1"],
        ["workshops", "completion", "w1"],
        ["workshops", "report"],
        DASHBOARD_SUMMARY_QUERY_KEY_ROOT,
        DYNAMIC_WIDGET_AGGREGATES_QUERY_KEY,
      ]),
    );
    expect(queried).not.toContainEqual(["workshops", "preferences"]);
  });

  it("refreshes only standing/report for attendance or scores, never the list", async () => {
    const { invalidateQueries, client } = queryClient();
    await invalidateWorkshopActivityQueries(client, "w1");
    const queried = keys(invalidateQueries);
    expect(queried).toEqual(
      expect.arrayContaining([
        ["workshops", "detail", "w1"],
        ["workshops", "completion", "w1"],
        ["workshops", "report"],
      ]),
    );
    expect(queried).not.toContainEqual(["workshops", "list"]);
    expect(queried).not.toContainEqual(["workshops", "metrics"]);
  });

  it("refreshes only preferences after Setup defaults change", async () => {
    const { invalidateQueries, client } = queryClient();
    await invalidateWorkshopPreferenceQueries(client);
    expect(keys(invalidateQueries)).toEqual([["workshops", "preferences"]]);
  });
});
