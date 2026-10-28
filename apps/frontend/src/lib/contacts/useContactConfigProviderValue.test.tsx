import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { useContactConfigProviderValue } from "./useContactConfigProviderValue";

describe("useContactConfigProviderValue", () => {
  it("preserves stable reference across re-renders with default options", () => {
    const observed: ReturnType<typeof useContactConfigProviderValue>[] = [];

    function TestComponent() {
      const val = useContactConfigProviderValue({});
      observed.push(val);
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

    expect(observed.length).toBeGreaterThan(1);
    const firstRef = observed[0];
    for (const ref of observed) {
      expect(ref).toBe(firstRef);
    }

    act(() => {
      root.unmount();
    });
  });

  it("checks tab field enabled and required states accurately", () => {
    let capturedVal: ReturnType<typeof useContactConfigProviderValue> | undefined;

    function TestComponent() {
      const val = useContactConfigProviderValue({
        fields: {
          basic: [
            { key: "fullName", label: "Full Name", enabled: true, required: true } as never,
            { key: "nickname", label: "Nickname", enabled: false, required: false } as never,
          ],
        },
      });
      capturedVal = val;
      return null;
    }

    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(<TestComponent />);
    });

    expect(capturedVal?.isTabFieldEnabled("basic", "fullName")).toBe(true);
    expect(capturedVal?.isTabFieldEnabled("basic", "nickname")).toBe(false);
    expect(capturedVal?.isTabFieldEnabled("nonexistent", "foo")).toBe(true);

    expect(capturedVal?.isTabFieldRequired("basic", "fullName")).toBe(true);
    expect(capturedVal?.isTabFieldRequired("basic", "nickname")).toBe(false);
    expect(capturedVal?.isTabFieldRequired("nonexistent", "foo")).toBe(false);

    act(() => {
      root.unmount();
    });
  });
});
