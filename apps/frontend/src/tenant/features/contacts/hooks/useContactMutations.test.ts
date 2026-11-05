import { afterEach, describe, expect, it, vi } from "vitest";
import { shouldQueueContactWrite } from "./useContactMutations";

function setOnline(online: boolean): void {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: online });
}

describe("shouldQueueContactWrite", () => {
  afterEach(() => {
    setOnline(true);
    vi.restoreAllMocks();
  });

  it("queues when the browser is offline regardless of the error", () => {
    setOnline(false);
    expect(shouldQueueContactWrite({ status: 400 })).toBe(true);
  });

  it("queues transport failures and 5xx responses while the browser reports online", () => {
    setOnline(true);
    expect(shouldQueueContactWrite(new TypeError("Failed to fetch"))).toBe(true);
    expect(shouldQueueContactWrite({ status: 500 })).toBe(true);
    expect(shouldQueueContactWrite({ status: 429 })).toBe(true);
  });

  it("does not queue validation or conflict responses", () => {
    setOnline(true);
    expect(shouldQueueContactWrite({ status: 400 })).toBe(false);
    expect(shouldQueueContactWrite({ status: 409 })).toBe(false);
  });
});
