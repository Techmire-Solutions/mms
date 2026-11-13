import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LazyDeferredView } from "./LazyDeferredView";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

type ObserverCallback = (entries: IntersectionObserverEntry[]) => void;

let observerCallback: ObserverCallback | null = null;
let observerCount = 0;
const disconnectMock = vi.fn();

class FakeIntersectionObserver {
  root = null;
  rootMargin = "";
  thresholds: number[] = [];
  constructor(callback: ObserverCallback) {
    observerCount += 1;
    observerCallback = callback;
  }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {
    disconnectMock();
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

function intersect(): void {
  observerCallback?.([{ isIntersecting: true } as IntersectionObserverEntry]);
}

describe("LazyDeferredView", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    observerCallback = null;
    observerCount = 0;
    disconnectMock.mockClear();
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
  });

  it("renders the fallback until the container intersects the viewport", async () => {
    await act(async () => {
      root.render(
        <LazyDeferredView fallback={<span>loading</span>}>
          <span>deferred content</span>
        </LazyDeferredView>,
      );
    });

    expect(container.textContent).toBe("loading");
    expect(observerCallback).not.toBeNull();

    await act(async () => {
      intersect();
    });

    expect(container.textContent).toBe("deferred content");
    expect(disconnectMock).toHaveBeenCalled();
  });

  it("keeps rendering children after the first intersection", async () => {
    await act(async () => {
      root.render(
        <LazyDeferredView fallback={<span>loading</span>}>
          <span>deferred content</span>
        </LazyDeferredView>,
      );
    });

    await act(async () => {
      intersect();
    });
    await act(async () => {
      intersect();
    });

    expect(container.textContent).toBe("deferred content");
    // The observer is created once and never re-created after visibility flips.
    expect(observerCount).toBe(1);
  });
});
