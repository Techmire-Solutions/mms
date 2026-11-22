import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLiveCollection } from "./useLiveCollection";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Simulates the db.ts collection store: `saveCollectionCacheOnly` writes to the
// store that `getCollection`/`hasCollectionInCache` read back from. Like the
// real getCollection, an uninitialised collection falls back to the seed.
let store: string[] = [];
const mockGetCollection = vi.fn(<T,>(_key: string, defaultValue: T[]) =>
  store.length > 0 ? (store as T[]) : defaultValue,
);
const mockHasCollectionInCache = vi.fn(() => store.length > 0);
const mockSaveCollectionCacheOnly = vi.fn((_key: string, rows: string[]) => {
  store = rows;
});
const mockApiFetch = vi.fn();

vi.mock("@/lib/db", () => ({
  getCollection: <T,>(key: string, defaultValue: T[]) => mockGetCollection(key, defaultValue),
  hasCollectionInCache: (_key: string) => mockHasCollectionInCache(),
  saveCollectionCacheOnly: (key: string, rows: unknown[]) =>
    mockSaveCollectionCacheOnly(key, rows as string[]),
}));

vi.mock("@/lib/apiClient", () => ({
  apiFetch: (url: string) => mockApiFetch(url),
}));

vi.mock("@/lib/contexts/AuthContext", () => ({
  useOptionalAuth: () => ({ isAuthenticated: true }),
}));

vi.mock("@/lib/clientErrorReporting", () => ({
  reportClientError: vi.fn(),
}));

describe("useLiveCollection", () => {
  let container: HTMLDivElement;
  let root: Root;
  let renderedRows: string[] = [];

  beforeEach(() => {
    store = [];
    renderedRows = [];
    mockGetCollection.mockClear();
    mockHasCollectionInCache.mockClear();
    mockSaveCollectionCacheOnly.mockClear();
    mockApiFetch.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  function Harness() {
    const rows = useLiveCollection<string>("test-collection", ["seed"]);
    renderedRows = rows;
    return null;
  }

  it("given a cold cache and a successful fetch, should render the fetched rows after the server response", async () => {
    // Arrange — manually resolved promise so the pre-fetch render is observable.
    let resolveFetch!: (value: unknown) => void;
    mockApiFetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );

    // Act — initial render reads the local seed while the fetch is pending.
    await act(async () => {
      root.render(<Harness />);
    });
    expect(renderedRows).toEqual(["seed"]);
    expect(mockApiFetch).toHaveBeenCalledWith("/api/db/collections/test-collection");

    await act(async () => {
      resolveFetch({ ok: true, json: async () => ["server-1", "server-2"] });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // Assert — the fetched rows were cached and published to the component.
    expect(mockSaveCollectionCacheOnly).toHaveBeenCalledWith("test-collection", [
      "server-1",
      "server-2",
    ]);
    expect(renderedRows).toEqual(["server-1", "server-2"]);
  });

  it("given a warm cache, should not call the server and should render the cached rows", async () => {
    // Arrange
    store = ["cached-1"];
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ["server-1"],
    });

    // Act
    await act(async () => {
      root.render(<Harness />);
    });

    // Assert
    expect(mockApiFetch).not.toHaveBeenCalled();
    expect(renderedRows).toEqual(["cached-1"]);
  });

  it("given enabled: false, should render the empty seed without any fetch", async () => {
    // Arrange & Act
    function DisabledHarness() {
      const rows = useLiveCollection<string>("test-collection", ["seed"], { enabled: false });
      renderedRows = rows;
      return null;
    }
    await act(async () => {
      root.render(<DisabledHarness />);
    });

    // Assert
    expect(renderedRows).toEqual([]);
    expect(mockApiFetch).not.toHaveBeenCalled();
  });
});
