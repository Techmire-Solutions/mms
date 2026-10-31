import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createModuleSetupConfigHooks } from "./createModuleSetupConfigHooks";

describe("createModuleSetupConfigHooks", () => {
  it("preserves stable placeholder object reference across multiple renders", () => {
    let callCount = 0;
    const hooks = createModuleSetupConfigHooks({
      preferencesQueryKey: ["test", "prefs"],
      fetchPreferences: vi.fn().mockResolvedValue({ theme: "dark" }),
      savePreferences: vi.fn(),
      preferencesPlaceholder: () => {
        callCount++;
        return { theme: "light" };
      },
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const observedData: Array<{ theme?: string }> = [];

    function TestComponent() {
      const query = hooks.usePreferencesQuery();
      if (query.data) {
        observedData.push(query.data);
      }
      return null;
    }

    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestComponent />
        </QueryClientProvider>,
      );
    });

    // Rerender multiple times
    for (let i = 0; i < 10; i++) {
      act(() => {
        root.render(
          <QueryClientProvider client={queryClient}>
            <TestComponent />
          </QueryClientProvider>,
        );
      });
    }

    // Must have resolved placeholder once and kept exact same object reference
    expect(callCount).toBe(1);
    expect(observedData.length).toBeGreaterThan(1);
    const firstRef = observedData[0];
    for (const ref of observedData) {
      expect(ref).toBe(firstRef);
    }

    act(() => {
      root.unmount();
    });
  });
});
