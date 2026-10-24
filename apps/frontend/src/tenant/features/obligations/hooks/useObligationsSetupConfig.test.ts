import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  useObligationsPreferencesQuery,
  useObligationsPreferencesMutation,
  useComposedObligationsSettings,
} from "./useObligationsSetupConfig";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/lib/query/createModuleSetupConfigHooks", () => ({
  createModuleSetupConfigHooks: () => ({
    usePreferencesQuery: () => ({
      data: { receiptPrefix: "TEST-OBL", receiptSequenceDigits: 6 },
      isLoading: false,
    }),
    usePreferencesMutation: () => ({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
    }),
  }),
}));

describe("useObligationsSetupConfig Hook suite", () => {
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
    let queryResult!: ReturnType<typeof useObligationsPreferencesQuery>;
    let mutationResult!: ReturnType<typeof useObligationsPreferencesMutation>;
    let composedResult!: ReturnType<typeof useComposedObligationsSettings>;

    function TestComponent() {
      queryResult = useObligationsPreferencesQuery();
      mutationResult = useObligationsPreferencesMutation();
      composedResult = useComposedObligationsSettings();
      return null;
    }

    await act(async () => {
      const root = createRoot(container!);
      root.render(React.createElement(TestComponent));
    });

    expect(queryResult.data).toBeDefined();
    expect(mutationResult.mutate).toBeDefined();
    expect(composedResult.receiptPrefix).toBe("TEST-OBL");
    expect(composedResult.receiptSequenceDigits).toBe(6);
  });
});
