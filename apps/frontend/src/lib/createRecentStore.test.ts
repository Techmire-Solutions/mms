import { afterEach, describe, expect, it } from "vitest";
import { createRecentStore } from "./createRecentStore";

const STORAGE_KEY = "mms_test_recent_store";

const store = createRecentStore(
  STORAGE_KEY,
  3,
  (value): value is string => typeof value === "string",
  (id) => id,
);

describe("createRecentStore", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("loads empty when nothing is stored", () => {
    expect(store.load()).toEqual([]);
  });

  it("prepends new items, dedupes by identity, and caps the list", () => {
    store.push("a");
    store.push("b");
    store.push("c");
    expect(store.load()).toEqual(["c", "b", "a"]);

    store.push("b");
    expect(store.load()).toEqual(["b", "c", "a"]);

    store.push("d");
    expect(store.load()).toEqual(["d", "b", "c"]);
  });

  it("drops invalid entries and non-array payloads", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["a", 42, "b", "c", "d"]));
    expect(store.load()).toEqual(["a", "b", "c"]);

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ not: "a list" }));
    expect(store.load()).toEqual([]);
  });

  it("persists pushes as a JSON array", () => {
    store.push("x");
    const stored = localStorage.getItem(STORAGE_KEY);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored ?? "[]")).toEqual(["x"]);
  });
});
