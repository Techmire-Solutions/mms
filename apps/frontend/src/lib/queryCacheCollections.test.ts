import { describe, expect, it, vi, beforeEach } from "vitest";

const getQueryData = vi.fn();
const getQueriesData = vi.fn();
const getCollection = vi.fn();

vi.mock("@/lib/queryClient", () => ({
  queryClientInstance: {
    getQueryData: (...args: unknown[]) => getQueryData(...args),
    getQueriesData: (...args: unknown[]) => getQueriesData(...args),
  },
}));

vi.mock("@/lib/db", () => ({
  getCollection: (...args: unknown[]) => getCollection(...args),
}));

import { findCachedCollectionRecord, readQueryCollection } from "@/lib/queryCacheCollections";

describe("queryCacheCollections", () => {
  beforeEach(() => {
    getQueryData.mockReset();
    getQueriesData.mockReset();
    getCollection.mockReset();
  });

  it("readQueryCollection prefers exact array matches", () => {
    getQueryData.mockReturnValue([{ id: "1" }]);
    expect(readQueryCollection(["sessions", "list"])).toEqual([{ id: "1" }]);
    expect(getQueriesData).not.toHaveBeenCalled();
  });

  it("findCachedCollectionRecord uses Query before localStorage", () => {
    getQueryData.mockReturnValue([{ id: "a" }, { id: "b" }]);
    getCollection.mockReturnValue([{ id: "b", stale: true }]);

    expect(findCachedCollectionRecord("sessions", "b", ["sessions", "list"])).toEqual({ id: "b" });
    expect(getCollection).not.toHaveBeenCalled();
  });

  it("findCachedCollectionRecord falls back to localStorage when Query misses", () => {
    getQueryData.mockReturnValue(undefined);
    getQueriesData.mockReturnValue([]);
    getCollection.mockReturnValue([{ id: "local-1", name: "Legacy" }]);

    expect(findCachedCollectionRecord("contacts", "local-1", ["contacts", "list"])).toEqual({
      id: "local-1",
      name: "Legacy",
    });
  });
});
