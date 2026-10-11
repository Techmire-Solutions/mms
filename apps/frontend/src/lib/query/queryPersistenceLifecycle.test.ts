import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dehydrate, QueryClient, type DehydratedState } from "@tanstack/react-query";
import { createQueryPersistenceLifecycle } from "./queryPersistenceLifecycle";

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("query persistence lifecycle", () => {
  let client: QueryClient;
  const persister = {
    restoreClient: vi.fn<() => Promise<DehydratedState | undefined>>(),
    persistClient: vi.fn<(state: DehydratedState) => Promise<void>>(),
    removeClient: vi.fn<() => Promise<void>>(),
  };
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    client = new QueryClient();
    persister.restoreClient.mockResolvedValue(undefined);
    persister.persistClient.mockResolvedValue();
    persister.removeClient.mockResolvedValue();
  });
  afterEach(() => {
    client.clear();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("starts only one restore and subscription", async () => {
    const lifecycle = createQueryPersistenceLifecycle(client, persister);
    await Promise.all([lifecycle.start(), lifecycle.start()]);
    client.setQueryData(["students"], ["current"]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(persister.restoreClient).toHaveBeenCalledOnce();
    expect(persister.persistClient).toHaveBeenCalledOnce();
  });

  it("cancels debounced saves and removes persisted data without waiting for the debounce", async () => {
    const lifecycle = createQueryPersistenceLifecycle(client, persister);
    await lifecycle.start();
    client.setQueryData(["students"], ["old"]);
    lifecycle.reset();
    await Promise.resolve();
    expect(persister.removeClient).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1000);
    expect(persister.persistClient).not.toHaveBeenCalled();
  });

  it("orders removal after an in-flight write and before the next session save", async () => {
    const pendingWrite = deferred<void>();
    const operations: string[] = [];
    persister.persistClient
      .mockImplementationOnce(async () => {
        await pendingWrite.promise;
        operations.push("old write");
      })
      .mockImplementation(async () => {
        operations.push("new write");
      });
    persister.removeClient.mockImplementation(async () => {
      operations.push("remove");
    });
    const lifecycle = createQueryPersistenceLifecycle(client, persister);
    await lifecycle.start();
    client.setQueryData(["students"], ["old"]);
    await vi.advanceTimersByTimeAsync(1000);
    lifecycle.reset();
    client.clear();
    client.setQueryData(["students"], ["new"]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(operations).toEqual([]);
    pendingWrite.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(operations).toEqual(["old write", "remove", "new write"]);
    expect(persister.persistClient.mock.calls.at(-1)?.[0].queries[0].state.data).toEqual(["new"]);
  });

  it("does not persist platform/auth queries or paused mutations", async () => {
    const lifecycle = createQueryPersistenceLifecycle(client, persister);
    await lifecycle.start();
    client.setQueryData(["platform", "workspaces"], ["private"]);
    client.setQueryData(["auth", "user"], { id: "old" });
    client.setQueryData(["students"], ["allowed"]);
    client.getMutationCache().build(
      client,
      {},
      {
        context: undefined,
        data: undefined,
        error: null,
        failureCount: 0,
        failureReason: null,
        isPaused: true,
        status: "pending",
        variables: undefined,
        submittedAt: 1,
      },
    );
    await vi.advanceTimersByTimeAsync(1000);
    const saved = persister.persistClient.mock.calls[0]?.[0];
    expect(saved?.queries.map((query) => query.queryKey)).toEqual([["students"]]);
    expect(saved?.mutations).toEqual([]);
  });

  it("restores query data but discards legacy paused mutations", async () => {
    const previous = new QueryClient();
    previous.setQueryData(["students"], ["cached"]);
    previous.setQueryData(["platform", "workspaces"], ["legacy-private"]);
    previous.setQueryData(["auth"], ["legacy-auth"]);
    previous.getMutationCache().build(
      previous,
      {},
      {
        context: undefined,
        data: undefined,
        error: null,
        failureCount: 0,
        failureReason: null,
        isPaused: true,
        status: "pending",
        variables: undefined,
        submittedAt: 1,
      },
    );
    persister.restoreClient.mockResolvedValue(dehydrate(previous));
    await createQueryPersistenceLifecycle(client, persister).start();
    expect(client.getQueryData(["students"])).toEqual(["cached"]);
    expect(client.getMutationCache().getAll()).toEqual([]);
    expect(client.getQueryData(["platform", "workspaces"])).toBeUndefined();
    expect(client.getQueryData(["auth"])).toBeUndefined();
    previous.clear();
  });

  it("continues after storage failures without an unhandled rejection", async () => {
    persister.restoreClient.mockRejectedValue(new Error("storage unavailable"));
    persister.persistClient.mockRejectedValueOnce(new Error("quota"));
    persister.removeClient.mockRejectedValueOnce(new Error("blocked"));
    const lifecycle = createQueryPersistenceLifecycle(client, persister);
    await lifecycle.start();
    client.setQueryData(["students"], ["one"]);
    await vi.advanceTimersByTimeAsync(1000);
    lifecycle.reset();
    client.setQueryData(["students"], ["two"]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(persister.persistClient).toHaveBeenCalledTimes(2);
  });
});
