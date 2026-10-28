import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { useUiPreference, useUiStateStore } from "./useUiStateStore";

describe("useUiStateStore", () => {
  it("initializes and updates state", () => {
    act(() => {
      useUiStateStore.getState().initialize({ theme: "dark" });
    });

    expect(useUiStateStore.getState().state.theme).toBe("dark");
    expect(useUiStateStore.getState().isInitialized).toBe(true);

    act(() => {
      useUiStateStore.getState().updateState("theme", "light");
    });
    expect(useUiStateStore.getState().state.theme).toBe("light");
  });

  it("useUiPreference returns stable setValue function across re-renders and updates state", () => {
    const observedSetValues: Array<(val: string) => void> = [];
    let currentVal = "";

    function TestComponent() {
      const [val, setValue] = useUiPreference("testKey", "defaultValue");
      currentVal = val;
      observedSetValues.push(setValue);
      return null;
    }

    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(<TestComponent />);
    });

    for (let i = 0; i < 5; i++) {
      act(() => {
        root.render(<TestComponent />);
      });
    }

    expect(observedSetValues.length).toBeGreaterThan(1);
    const firstFn = observedSetValues[0];
    for (const fn of observedSetValues) {
      expect(fn).toBe(firstFn);
    }
    expect(currentVal).toBe("defaultValue");

    act(() => {
      firstFn("newValue");
    });
    expect(currentVal).toBe("newValue");

    act(() => {
      root.unmount();
    });
  });
});
