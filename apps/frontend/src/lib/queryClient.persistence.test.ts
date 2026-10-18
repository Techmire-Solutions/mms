import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { dehydrate, QueryClient, type DehydratedState } from "@tanstack/react-query";
import type { User } from "@mms/shared";
import {
  readQueryCacheSession,
  resolveQueryCacheSession,
  tenantCacheIdentity,
} from "./query/queryCacheSession";

const storage = vi.hoisted(() => ({
  values: new Map<string, DehydratedState>(),
  restore: vi.fn<(key: string) => Promise<DehydratedState | undefined>>(),
  save: vi.fn<(key: string, state: DehydratedState) => Promise<void>>(),
  remove: vi.fn<(key: string) => Promise<void>>(),
}));
vi.mock("./query/idbCachePersister", () => ({
  createIdbCachePersister: (options?: { key?: string }) => {
    const key = options?.key ?? "legacy";
    return {
      restoreClient: () => storage.restore(key),
      persistClient: (state: DehydratedState) => storage.save(key, state),
      removeClient: () => storage.remove(key),
    };
  },
}));
const user: User = {
  id: "a",
  name: "A",
  email: "a@example.test",
  role: "admin",
  workspaceSubdomain: "school",
};
function records(value: string) {
  const previous = new QueryClient();
  previous.setQueryData(["students"], [value]);
  const state = dehydrate(previous);
  previous.clear();
  return state;
}

describe("verified query cache sessions", () => {
  // Warm the module graph once (hookTimeout budget): the cold transform of `./queryClient`
  // otherwise lands in the first test and exceeds testTimeout under full-suite load.
  // Tests still get fresh module instances via `vi.resetModules()`.
  beforeAll(async () => {
    await import("./queryClient");
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    vi.resetAllMocks();
    localStorage.clear();
    storage.values.clear();
    storage.restore.mockImplementation(async (key) => storage.values.get(key));
    storage.save.mockImplementation(async (key, state) => {
      storage.values.set(key, state);
    });
    storage.remove.mockImplementation(async (key) => {
      storage.values.delete(key);
    });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("does not restore or save before a verified session activates persistence", async () => {
    storage.values.set("legacy", records("unscoped"));
    const { queryClientInstance: client } = await import("./queryClient");
    client.setQueryData(["public"], "public");
    await vi.advanceTimersByTimeAsync(1000);
    expect(storage.restore).not.toHaveBeenCalled();
    expect(storage.save).not.toHaveBeenCalled();
    expect(client.getQueryData(["students"])).toBeUndefined();
    expect(storage.values.has("legacy")).toBe(false);
  });

  it("restores a matching verified identity and keeps initialization idempotent", async () => {
    const session = resolveQueryCacheSession(tenantCacheIdentity(user));
    if (!session) throw new Error("Expected storage");
    storage.values.set(session.key, records("a"));
    const { queryClientInstance: client } = await import("./queryClient");
    await Promise.all([client.activateTenantSession(user), client.activateTenantSession(user)]);
    expect(client.getQueryData(["students"])).toEqual(["a"]);
    expect(storage.restore).toHaveBeenCalledExactlyOnceWith(session.key);
  });

  it.each([
    { ...user, id: "b" },
    { ...user, role: "teacher" },
    { ...user, workspaceSubdomain: "other" },
  ])("rotates the cache on identity change: %j", async (next) => {
    const { queryClientInstance: client } = await import("./queryClient");
    await client.activateTenantSession(user);
    const previousKey = readQueryCacheSession()?.key;
    client.setQueryData(["students"], ["a"]);
    await vi.advanceTimersByTimeAsync(1000);
    await client.activateTenantSession(next);
    expect(readQueryCacheSession()?.key).not.toBe(previousKey);
    expect(client.getQueryData(["students"])).toBeUndefined();
  });

  it("rejects a delayed restore after logout and revokes the key synchronously", async () => {
    let restore: (state: DehydratedState) => void = () => {};
    storage.restore.mockImplementation(
      () =>
        new Promise((resolve) => {
          restore = resolve;
        }),
    );
    const { queryClientInstance: client } = await import("./queryClient");
    const pending = client.activateTenantSession(user);
    client.clear();
    expect(readQueryCacheSession()).toBeUndefined();
    restore(records("a"));
    await pending;
    expect(client.getQueryData(["students"])).toBeUndefined();
  });

  it("cannot reuse the revoked key on reload while disk deletion is still pending", async () => {
    storage.remove.mockImplementation(() => new Promise(() => {}));
    const { queryClientInstance: client } = await import("./queryClient");
    await client.activateTenantSession(user);
    client.setQueryData(["students"], ["a"]);
    await vi.advanceTimersByTimeAsync(1000);
    const oldKey = readQueryCacheSession()?.key;
    client.clear();
    vi.resetModules();
    const { queryClientInstance: reloaded } = await import("./queryClient");
    await reloaded.activateTenantSession(user);
    expect(readQueryCacheSession()?.key).not.toBe(oldKey);
    expect(reloaded.getQueryData(["students"])).toBeUndefined();
  });

  it("rejects a restore after another tab rotates the active key", async () => {
    let restore: (state: DehydratedState) => void = () => {};
    storage.restore.mockImplementation(
      () =>
        new Promise((resolve) => {
          restore = resolve;
        }),
    );
    const { queryClientInstance: client } = await import("./queryClient");
    const pending = client.activateTenantSession(user);
    resolveQueryCacheSession(tenantCacheIdentity({ ...user, id: "b" }));
    restore(records("a"));
    await pending;
    expect(client.getQueryData(["students"])).toBeUndefined();
    client.setQueryData(["students"], ["late-a"]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(storage.save).not.toHaveBeenCalled();
  });

  it("keeps persistence disabled for a required password change or unavailable storage", async () => {
    const { queryClientInstance: client } = await import("./queryClient");
    await client.activateTenantSession({ ...user, mustChangePassword: true });
    expect(storage.restore).not.toHaveBeenCalled();
    const blocked = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    try {
      await client.activateTenantSession(user);
      client.setQueryData(["students"], ["live"]);
      await vi.advanceTimersByTimeAsync(1000);
      expect(storage.restore).not.toHaveBeenCalled();
      expect(storage.save).not.toHaveBeenCalled();
    } finally {
      blocked.mockRestore();
    }
  });
});
