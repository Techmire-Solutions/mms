import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { usePersistedTabState } from "./usePersistedTabState";
import { useUiStateStore } from "@/lib/useUiStateStore";

describe("usePersistedTabState", () => {
  it("migrates legacy module-tier ids by default", () => {
    act(() => {
      useUiStateStore.getState().initialize({ "tier-test-tab": "configuration" });
    });

    let value = "";
    function TestComponent() {
      const [v] = usePersistedTabState<string>("tier-test-tab", "work");
      value = v;
      return null;
    }

    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(<TestComponent />);
    });
    expect(value).toBe("setup");
    act(() => {
      root.unmount();
    });
  });

  it("passes an identity override through unchanged", () => {
    act(() => {
      useUiStateStore.getState().initialize({ "settings-test-tab": "configuration" });
    });

    let value = "";
    function TestComponent() {
      const [v] = usePersistedTabState<string>("settings-test-tab", "global", (id) => id);
      value = v;
      return null;
    }

    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(<TestComponent />);
    });
    expect(value).toBe("configuration");
    act(() => {
      root.unmount();
    });
  });
});
