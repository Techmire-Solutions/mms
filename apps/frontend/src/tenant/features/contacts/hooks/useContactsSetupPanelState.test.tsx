import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DEFAULT_CONTACT_PREFERENCES } from "@mms/shared";
import { useContactsSetupPanelState } from "./useContactsSetupPanelState";

const mockUpdatePrefsAsync = vi.fn().mockResolvedValue({});
const mockUpdateCountryCodes = vi.fn().mockResolvedValue({});

vi.mock("@/lib/contexts/ContactConfigContext", () => ({
  useContactConfig: () => ({
    prefs: DEFAULT_CONTACT_PREFERENCES,
    countryCodes: [{ country: "PK", code: "+92" }],
    updatePrefsAsync: mockUpdatePrefsAsync,
    updateCountryCodes: mockUpdateCountryCodes,
  }),
}));

describe("useContactsSetupPanelState", () => {
  it("initializes state from context config without triggering infinite loops", () => {
    let state: ReturnType<typeof useContactsSetupPanelState> | undefined;

    function TestComponent() {
      state = useContactsSetupPanelState();
      return <div>{state.countryCodes.length}</div>;
    }

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestComponent />
        </QueryClientProvider>,
      );
    });

    expect(state).toBeDefined();
    expect(state?.isPrefsDirty).toBe(false);
    expect(state?.countryCodes).toEqual([{ country: "PK", code: "+92" }]);

    act(() => {
      state?.updateCountryCodes([{ country: "US", code: "+1" }]);
    });

    expect(state?.isPrefsDirty).toBe(true);
    expect(state?.countryCodes).toEqual([{ country: "US", code: "+1" }]);

    act(() => {
      root.unmount();
    });
  });
});
