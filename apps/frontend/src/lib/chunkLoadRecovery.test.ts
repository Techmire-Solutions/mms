import { describe, it, expect, vi } from "vitest";
import {
  CHUNK_LOAD_ERROR_EVENT,
  CHUNK_RELOAD_STORAGE_KEY,
  CHUNK_RELOAD_THROTTLE_MS,
  installChunkLoadRecovery,
  type ChunkLoadRecoveryDeps,
} from "./chunkLoadRecovery";

function createStorage(initial?: Record<string, string>): Pick<Storage, "getItem" | "setItem"> {
  const data = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

function setup(overrides: Partial<ChunkLoadRecoveryDeps> = {}) {
  const target = new EventTarget();
  const reload = vi.fn();
  let clock = 1_000_000;
  const now = () => clock;
  const storage = createStorage();
  const uninstall = installChunkLoadRecovery({ target, reload, now, storage, ...overrides });
  return {
    target,
    reload,
    storage,
    uninstall,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

function dispatchPreloadError(target: EventTarget): Event {
  const event = new Event(CHUNK_LOAD_ERROR_EVENT, { cancelable: true });
  target.dispatchEvent(event);
  return event;
}

describe("installChunkLoadRecovery", () => {
  it("prevents the default and reloads once on a stale-chunk failure", () => {
    const { target, reload } = setup();

    const event = dispatchPreloadError(target);

    expect(event.defaultPrevented).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("records the reload timestamp for the loop guard", () => {
    const { target, storage } = setup();

    dispatchPreloadError(target);

    expect(storage.getItem(CHUNK_RELOAD_STORAGE_KEY)).toBe("1000000");
  });

  it("does not reload again inside the throttle window (error boundary wins)", () => {
    const { target, reload, advance } = setup();

    dispatchPreloadError(target);
    advance(CHUNK_RELOAD_THROTTLE_MS - 1);
    const second = dispatchPreloadError(target);

    expect(reload).toHaveBeenCalledTimes(1);
    expect(second.defaultPrevented).toBe(false);
  });

  it("reloads again once the throttle window has elapsed", () => {
    const { target, reload, advance } = setup();

    dispatchPreloadError(target);
    advance(CHUNK_RELOAD_THROTTLE_MS);
    const second = dispatchPreloadError(target);

    expect(reload).toHaveBeenCalledTimes(2);
    expect(second.defaultPrevented).toBe(true);
  });

  it("reloads even when the timestamp storage throws", () => {
    const throwingStorage: Pick<Storage, "getItem" | "setItem"> = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    const { target, reload } = setup({ storage: throwingStorage });

    const event = dispatchPreloadError(target);

    expect(event.defaultPrevented).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("works without any storage", () => {
    const { target, reload, advance } = setup({ storage: null });

    dispatchPreloadError(target);
    advance(CHUNK_RELOAD_THROTTLE_MS + 1);
    dispatchPreloadError(target);

    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("stops handling events after uninstall", () => {
    const { target, reload, uninstall } = setup();

    uninstall();
    dispatchPreloadError(target);

    expect(reload).not.toHaveBeenCalled();
  });
});
