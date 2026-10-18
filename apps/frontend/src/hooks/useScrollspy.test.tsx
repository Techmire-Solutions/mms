import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useScrollspy, isNativeScrollspySupported } from "./useScrollspy";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

type IntersectionCallback = (entries: IntersectionObserverEntry[]) => void;

function makeObserverMock() {
  let callback: IntersectionCallback = () => {};
  const observe = vi.fn();
  const unobserve = vi.fn();
  const disconnect = vi.fn();

  class MockObserver {
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds = [];
    observe = observe;
    unobserve = unobserve;
    disconnect = disconnect;
    takeRecords = () => [];

    constructor(cb: IntersectionCallback) {
      callback = cb;
    }
  }

  const trigger = (id: string, isIntersecting: boolean) => {
    callback([{ target: { id } as Element, isIntersecting } as IntersectionObserverEntry]);
  };

  return { MockObserver, observe, disconnect, trigger };
}

function TestComponent({
  sections,
  onActiveChange,
}: {
  sections: string[];
  onActiveChange: (active: string | null) => void;
}): React.JSX.Element {
  const active = useScrollspy(sections);
  React.useEffect(() => {
    onActiveChange(active);
  }, [active, onActiveChange]);

  return <div data-testid="scrollspy-test">{active ?? "none"}</div>;
}

describe("useScrollspy", () => {
  let container: HTMLDivElement;
  let root: Root;
  const originalCSSDescriptor = Object.getOwnPropertyDescriptor(window, "CSS");
  const originalWindowObserver = window.IntersectionObserver;
  const originalGlobalObserver = globalThis.IntersectionObserver;

  const setSupportsMock = (fn: (prop: string, val?: string) => boolean) => {
    Object.defineProperty(window, "CSS", {
      configurable: true,
      get: () => ({
        supports: fn,
      }),
    });
  };

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    if (originalCSSDescriptor) {
      Object.defineProperty(window, "CSS", originalCSSDescriptor);
    }
    window.IntersectionObserver = originalWindowObserver;
    globalThis.IntersectionObserver = originalGlobalObserver;
    vi.restoreAllMocks();
  });

  it("isNativeScrollspySupported returns false when CSS.supports does not match", () => {
    setSupportsMock(() => false);
    expect(isNativeScrollspySupported()).toBe(false);
  });

  it("isNativeScrollspySupported returns true when CSS.supports matches", () => {
    setSupportsMock(
      (prop: string, val?: string) => prop === "scroll-target-group" && val === "auto",
    );
    expect(isNativeScrollspySupported()).toBe(true);
  });

  it("returns null when native CSS scroll-target-group is supported", async () => {
    setSupportsMock(() => true);

    let currentActive: string | null = "initial";
    await act(async () => {
      root.render(
        <TestComponent
          sections={["sec1", "sec2"]}
          onActiveChange={(val) => (currentActive = val)}
        />,
      );
    });

    expect(currentActive).toBeNull();
  });

  it("tracks intersecting section in polyfill mode", async () => {
    setSupportsMock(() => false);

    const { MockObserver, trigger } = makeObserverMock();
    window.IntersectionObserver = MockObserver as unknown as typeof IntersectionObserver;
    globalThis.IntersectionObserver = MockObserver as unknown as typeof IntersectionObserver;

    const secEl = document.createElement("section");
    secEl.id = "sec1";
    document.body.appendChild(secEl);

    let currentActive: string | null = "initial";
    await act(async () => {
      root.render(
        <TestComponent sections={["sec1"]} onActiveChange={(val) => (currentActive = val)} />,
      );
    });

    expect(currentActive).toBeNull();

    act(() => {
      trigger("sec1", true);
    });

    expect(currentActive).toBe("sec1");
    document.body.removeChild(secEl);
  });

  it("disconnects observer on unmount in polyfill mode", async () => {
    setSupportsMock(() => false);

    const { MockObserver, disconnect } = makeObserverMock();
    window.IntersectionObserver = MockObserver as unknown as typeof IntersectionObserver;
    globalThis.IntersectionObserver = MockObserver as unknown as typeof IntersectionObserver;

    await act(async () => {
      root.render(<TestComponent sections={["sec1"]} onActiveChange={() => {}} />);
    });

    await act(async () => {
      root.unmount();
    });

    expect(disconnect).toHaveBeenCalled();
  });
});
