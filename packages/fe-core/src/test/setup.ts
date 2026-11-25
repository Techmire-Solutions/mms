import { afterEach } from "vitest";

export {};

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

if (typeof window !== "undefined") {
  if (!window.matchMedia) {
    const matchMediaStub = (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList;
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: matchMediaStub,
    });
    globalThis.matchMedia ??= matchMediaStub;
  }
}

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
if (typeof window !== "undefined") {
  window.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
}

class IntersectionObserverStub {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds: ReadonlyArray<number> = [];
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
globalThis.IntersectionObserver ??=
  IntersectionObserverStub as unknown as typeof IntersectionObserver;
if (typeof window !== "undefined") {
  window.IntersectionObserver ??=
    IntersectionObserverStub as unknown as typeof IntersectionObserver;
}

afterEach(() => {
  if (typeof window !== "undefined") {
    window.localStorage?.clear?.();
    window.sessionStorage?.clear?.();
  }
});
