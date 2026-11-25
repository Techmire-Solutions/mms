import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, unknown>();
const savedEntries: Array<[string, unknown]> = [];
const dispatchSpy = vi.fn();

vi.mock("@/lib/db", () => ({
  getObject: <T>(key: string, fallback: T): T =>
    store.has(key) ? (store.get(key) as T) : fallback,
  saveObject: (key: string, value: unknown) => {
    savedEntries.push([key, value]);
    store.set(key, value);
  },
}));

import {
  readDashboardSwitchState,
  toggleDashboardSwitchState,
} from "@/tenant/features/reports/components/pinnedWidgets/useDashboardSectionSettings";

describe("useDashboardSectionSettings", () => {
  beforeEach(() => {
    store.clear();
    savedEntries.length = 0;
    dispatchSpy.mockClear();
    vi.spyOn(window, "dispatchEvent").mockImplementation((event) => {
      dispatchSpy(event);
      return true;
    });
  });

  it("toggles a section_* key inside the shared dashboard_section_settings record", () => {
    store.set("dashboard_section_settings", { enrollmentChart: true });

    toggleDashboardSwitchState("section_enrollmentChart");

    expect(savedEntries).toEqual([["dashboard_section_settings", { enrollmentChart: false }]]);
    expect(readDashboardSwitchState("section_enrollmentChart")).toBe(false);
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
  });

  it("toggles a plain app-setting key in its own storage entry", () => {
    store.set("realtime_badge", true);

    toggleDashboardSwitchState("realtime_badge");

    expect(savedEntries).toEqual([["realtime_badge", false]]);
    expect(readDashboardSwitchState("realtime_badge")).toBe(false);
  });

  it("ignores an empty switch key instead of writing an empty storage entry", () => {
    toggleDashboardSwitchState("");

    expect(savedEntries).toHaveLength(0);
    expect(readDashboardSwitchState("")).toBe(false);
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it("returns false for an empty section key and does not mutate the section record", () => {
    store.set("dashboard_section_settings", { enrollmentChart: true });

    toggleDashboardSwitchState("section_");

    expect(savedEntries).toHaveLength(0);
    expect(readDashboardSwitchState("section_")).toBe(false);
    expect(store.get("dashboard_section_settings")).toEqual({ enrollmentChart: true });
  });
});
