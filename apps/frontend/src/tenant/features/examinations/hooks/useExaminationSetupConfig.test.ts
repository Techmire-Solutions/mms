import { describe, expect, it, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import {
  useExaminationPreferencesQuery,
  useExaminationPreferencesMutation,
  useComposedExaminationsSettings,
} from "./useExaminationSetupConfig";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/tenant/features/examinations/hooks/examinationSetupConfigApi", () => ({
  fetchExaminationPreferences: vi.fn().mockResolvedValue({
    gradingSystem: "percentage",
    certificateTemplate: "default",
  }),
  saveExaminationPreferencesAsync: vi.fn(),
  setExaminationPreferencesMemory: vi.fn(),
}));

vi.mock("@/lib/query/createModuleSetupConfigHooks", () => ({
  createModuleSetupConfigHooks: () => ({
    usePreferencesQuery: () => ({
      data: { gradingSystem: "percentage", certificateTemplate: "default" },
      isLoading: false,
    }),
    usePreferencesMutation: () => ({
      mutateAsync: vi.fn(),
    }),
  }),
}));

describe("useExaminationSetupConfig Hooks", () => {
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    return () => {
      if (container) {
        container.remove();
        container = null;
      }
    };
  });

  it("provides preferences query, mutation and composed settings", async () => {
    let queryResult!: ReturnType<typeof useExaminationPreferencesQuery>;
    let mutationResult!: ReturnType<typeof useExaminationPreferencesMutation>;
    let settingsResult!: ReturnType<typeof useComposedExaminationsSettings>;

    function TestComponent() {
      queryResult = useExaminationPreferencesQuery();
      mutationResult = useExaminationPreferencesMutation();
      settingsResult = useComposedExaminationsSettings();
      return null;
    }

    const root = createRoot(container!);
    await act(async () => {
      root.render(React.createElement(TestComponent));
    });

    expect(queryResult.data.gradingSystem).toBe("percentage");
    expect(mutationResult.mutateAsync).toBeDefined();
    expect(settingsResult.gradingSystem).toBe("percentage");
  });
});
