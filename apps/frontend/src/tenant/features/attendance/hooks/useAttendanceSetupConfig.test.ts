import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  useAttendancePreferencesQuery,
  useAttendancePreferencesMutation,
  useComposedAttendanceSettings,
} from "./useAttendanceSetupConfig";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/lib/query/createModuleSetupConfigHooks", () => ({
  createModuleSetupConfigHooks: () => ({
    usePreferencesQuery: () => ({
      data: { lateThresholdMins: 15 },
      isLoading: false,
    }),
    usePreferencesMutation: () => ({
      mutateAsync: vi.fn(),
    }),
  }),
}));

describe("useAttendanceSetupConfig Hook suite", () => {
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container) {
      document.body.removeChild(container);
      container = null;
    }
  });

  it("provides preferences query, mutation and composed settings", async () => {
    let queryResult!: ReturnType<typeof useAttendancePreferencesQuery>;
    let mutationResult!: ReturnType<typeof useAttendancePreferencesMutation>;
    let composedResult!: ReturnType<typeof useComposedAttendanceSettings>;

    function TestComponent() {
      queryResult = useAttendancePreferencesQuery();
      mutationResult = useAttendancePreferencesMutation();
      composedResult = useComposedAttendanceSettings();
      return null;
    }

    await act(async () => {
      const root = createRoot(container!);
      root.render(React.createElement(TestComponent));
    });

    expect(queryResult.data).toBeDefined();
    expect(mutationResult.mutateAsync).toBeDefined();
    expect(composedResult.lateThresholdMins).toBe(15);
  });
});
