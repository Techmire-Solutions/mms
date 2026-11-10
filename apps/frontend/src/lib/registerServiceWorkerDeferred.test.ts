import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { registerServiceWorkerDeferred } from "./registerServiceWorkerDeferred";

vi.mock("./runAfterFirstPaint", () => ({
  runAfterFirstPaint: (cb: () => void) => {
    cb();
    return () => {};
  },
}));

describe("registerServiceWorkerDeferred", () => {
  const originalNavigator = globalThis.navigator;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
  });

  it("registers service worker after first paint when serviceWorker is in navigator", async () => {
    const registerMock = vi.fn().mockResolvedValue({});
    Object.defineProperty(globalThis, "navigator", {
      value: {
        ...originalNavigator,
        serviceWorker: {
          register: registerMock,
        },
      },
      configurable: true,
      writable: true,
    });

    registerServiceWorkerDeferred();

    // Allow promise microtasks to resolve
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(registerMock).toHaveBeenCalledWith("/sw.js", { scope: "/" });
  });

  it("safely no-ops when serviceWorker is not supported", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: {},
      configurable: true,
      writable: true,
    });

    expect(() => registerServiceWorkerDeferred()).not.toThrow();
  });
});
