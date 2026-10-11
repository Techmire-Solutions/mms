import { describe, expect, it } from "vitest";
import {
  filterDashboardCardWidgets,
  isDashboardWidgetModuleEnabled,
  resolveDashboardTrendMetric,
  isWidgetActiveForDashboard,
  filterDashboardWidgetsByCollection,
  getRequiredDashboardCollections,
  getActiveCustomCardIds,
  getPinnedDashboardWidgetCount,
  isDashboardWidgetPermitted,
  isDashboardWidgetAllowed,
  getDashboardWidgetRequiredPermission,
} from "@/lib/dashboardCollections";
import type { CustomWidget } from "@/lib/reports/pinnedWidgetTypes";

const cardWidget = (overrides: Partial<CustomWidget> = {}): CustomWidget => ({
  id: "w1",
  title: "Widget",
  category: "general",
  operation: "count",
  color: "#000000",
  widgetType: "card",
  role: "admin",
  collection: "students",
  isPinnedToDashboard: false,
  ...overrides,
});

describe("filterDashboardCardWidgets", () => {
  it("keeps only card-type widgets matching the dashboard role", () => {
    const widgets = [
      cardWidget({ id: "a", role: "admin" }),
      cardWidget({ id: "b", role: "accountant" }),
      cardWidget({ id: "c", role: "admin", widgetType: "chart" }),
    ];
    const result = filterDashboardCardWidgets(widgets, "admin");
    expect(result.map((w) => w.id)).toEqual(["a"]);
  });
});

describe("isDashboardWidgetModuleEnabled", () => {
  it("returns true when the module is not disabled", () => {
    expect(isDashboardWidgetModuleEnabled(cardWidget({ collection: "students" }), {})).toBe(true);
  });

  it("returns false when the module is disabled", () => {
    expect(
      isDashboardWidgetModuleEnabled(cardWidget({ collection: "students" }), { students: false }),
    ).toBe(false);
  });

  it("returns true for unknown collections", () => {
    expect(
      isDashboardWidgetModuleEnabled(
        cardWidget({ collection: "unknown" as CustomWidget["collection"] }),
        {},
      ),
    ).toBe(true);
  });

  it("handles hasanat-distribution widgetType", () => {
    const widget = cardWidget({
      id: "def-hasanat-distribution",
      widgetType: "hasanat-distribution",
      collection: "hasanat_distributions",
    });
    expect(isDashboardWidgetModuleEnabled(widget, {})).toBe(true);
    expect(isDashboardWidgetModuleEnabled(widget, { hasanat: false })).toBe(false);
  });
});

describe("isDashboardWidgetPermitted & isDashboardWidgetAllowed", () => {
  it("resolves required permission for hasanat-distribution widget", () => {
    const widget = cardWidget({
      id: "def-hasanat-distribution",
      widgetType: "hasanat-distribution",
      collection: "hasanat_distributions",
    });
    expect(getDashboardWidgetRequiredPermission(widget)).toBe("hasanat.read");
    expect(isDashboardWidgetPermitted(widget, (perm) => perm === "hasanat.read")).toBe(true);
    expect(isDashboardWidgetPermitted(widget, () => false)).toBe(false);
  });

  it("evaluates isDashboardWidgetAllowed with both module enablement and permissions", () => {
    const widget = cardWidget({
      id: "def-hasanat-distribution",
      widgetType: "hasanat-distribution",
      collection: "hasanat_distributions",
    });
    // Allowed when module enabled and permitted
    expect(isDashboardWidgetAllowed(widget, {}, (perm) => perm === "hasanat.read")).toBe(true);
    // Disallowed when module disabled
    expect(
      isDashboardWidgetAllowed(widget, { hasanat: false }, (perm) => perm === "hasanat.read"),
    ).toBe(false);
    // Disallowed when permission lacking
    expect(isDashboardWidgetAllowed(widget, {}, () => false)).toBe(false);
  });
});

describe("resolveDashboardTrendMetric", () => {
  it("uses id heuristics for custom cards", () => {
    expect(resolveDashboardTrendMetric("attendance-rate")).toBe("attendance");
    expect(resolveDashboardTrendMetric("fees-collected")).toBe("fees");
    expect(resolveDashboardTrendMetric("outstanding-balance")).toBe("outstanding");
    expect(resolveDashboardTrendMetric("hasanat-points")).toBe("hasanat");
    expect(resolveDashboardTrendMetric("sessions-count")).toBe("sessions");
  });

  it("returns undefined for unrecognized ids", () => {
    expect(resolveDashboardTrendMetric("random")).toBeUndefined();
  });
});

describe("isWidgetActiveForDashboard", () => {
  it("is active when pinned or a role-matching card", () => {
    expect(isWidgetActiveForDashboard(cardWidget({ isPinnedToDashboard: true }), "admin")).toBe(
      true,
    );
    expect(isWidgetActiveForDashboard(cardWidget({ role: "admin" }), "admin")).toBe(true);
    expect(isWidgetActiveForDashboard(cardWidget({ role: "accountant" }), "admin")).toBe(false);
  });
});

describe("filterDashboardWidgetsByCollection", () => {
  it("filters by collection and active state", () => {
    const widgets = [
      cardWidget({ id: "a", collection: "students", role: "admin" }),
      cardWidget({ id: "b", collection: "students", role: "accountant" }),
      cardWidget({ id: "c", collection: "faculty", role: "admin" }),
    ];
    const result = filterDashboardWidgetsByCollection(widgets, "students", "admin");
    expect(result.map((w) => w.id)).toEqual(["a"]);
  });
});

describe("getRequiredDashboardCollections", () => {
  it("collects collections from active widgets", () => {
    const widgets = [
      cardWidget({ id: "a", collection: "students", role: "admin" }),
      cardWidget({ id: "b", collection: "faculty", role: "accountant" }),
    ];
    const required = getRequiredDashboardCollections(widgets, "admin");
    expect(required.has("students")).toBe(true);
    expect(required.has("faculty")).toBe(false);
  });

  it("filters out disabled or unpermitted widgets", () => {
    const widgets = [
      cardWidget({ id: "a", collection: "students", role: "admin" }),
      cardWidget({
        id: "def-hasanat-distribution",
        widgetType: "hasanat-distribution",
        collection: "hasanat_distributions",
        isPinnedToDashboard: true,
      }),
    ];
    // With hasanat disabled
    const reqWithoutHasanat = getRequiredDashboardCollections(
      widgets,
      "admin",
      { hasanat: false },
      () => true,
    );
    expect(reqWithoutHasanat.has("students")).toBe(true);
    expect(reqWithoutHasanat.has("hasanat_distributions")).toBe(false);

    // With hasanat permission denied
    const reqDeniedPerm = getRequiredDashboardCollections(
      widgets,
      "admin",
      {},
      (perm) => perm !== "hasanat.read",
    );
    expect(reqDeniedPerm.has("hasanat_distributions")).toBe(false);
  });
});

describe("getActiveCustomCardIds", () => {
  it("returns non-seeded active card ids", () => {
    const widgets = [
      cardWidget({ id: "custom-1", role: "admin" }),
      cardWidget({ id: "def-card-1", role: "admin" }),
    ];
    const ids = getActiveCustomCardIds(widgets, "admin");
    expect(ids).toEqual(["custom-1"]);
  });
});

describe("getPinnedDashboardWidgetCount", () => {
  it("counts pinned non-card widgets", () => {
    const widgets = [
      cardWidget({ isPinnedToDashboard: true, widgetType: "chart" }),
      cardWidget({ isPinnedToDashboard: true, widgetType: "card" }),
      cardWidget({ isPinnedToDashboard: false, widgetType: "chart" }),
    ];
    expect(getPinnedDashboardWidgetCount(widgets)).toBe(1);
  });

  it("filters out disabled or unpermitted pinned widgets", () => {
    const widgets = [
      cardWidget({
        id: "def-hasanat-distribution",
        isPinnedToDashboard: true,
        widgetType: "hasanat-distribution",
        collection: "hasanat_distributions",
      }),
      cardWidget({
        id: "w2",
        isPinnedToDashboard: true,
        widgetType: "chart",
        collection: "students",
      }),
    ];
    expect(getPinnedDashboardWidgetCount(widgets, { hasanat: false })).toBe(1);
    expect(getPinnedDashboardWidgetCount(widgets, {}, (perm) => perm !== "hasanat.read")).toBe(1);
    expect(getPinnedDashboardWidgetCount(widgets, {}, () => true)).toBe(2);
  });
});
