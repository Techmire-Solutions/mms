import { describe, it, expect, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { useInitializeUiState } from "./useInitializeUiState";
import { createTestQueryClient } from "@/test/queryClientTestUtils";

const mocks = vi.hoisted(() => ({
  getUiState: vi.fn(),
  initialize: vi.fn(),
  isInitialized: false,
  isAuthenticated: true,
}));

vi.mock("@/lib/api", () => ({
  apiContract: { auth: { getUiState: mocks.getUiState } },
}));
vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: mocks.isAuthenticated }),
}));
vi.mock("@/lib/useUiStateStore", () => ({
  useUiStateStore: (
    selector: (s: { initialize: typeof mocks.initialize; isInitialized: boolean }) => unknown,
  ) => selector({ initialize: mocks.initialize, isInitialized: mocks.isInitialized }),
}));

function renderHook(client: QueryClient): () => void {
  function Harness() {
    useInitializeUiState();
    return null;
  }
  const div = document.createElement("div");
  const root = createRoot(div);
  act(() => {
    root.render(
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>,
    );
  });
  return () => act(() => root.unmount());
}

describe("useInitializeUiState", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = createTestQueryClient();
    mocks.getUiState.mockReset();
    mocks.getUiState.mockResolvedValue({ status: 200, body: { state: { readKeys: [] } } });
    mocks.initialize.mockReset();
    mocks.isInitialized = false;
    mocks.isAuthenticated = true;
  });

  it("does not request UI state while the session is unauthenticated", async () => {
    // Regression: mounted in the shell without an auth gate, the query fired
    // /api/auth/me/ui-state on unauthenticated mounts (401 storm).
    mocks.isAuthenticated = false;
    const unmount = renderHook(client);
    await act(async () => {});

    expect(mocks.getUiState).not.toHaveBeenCalled();
    unmount();
  });

  it("forwards the query signal to the auth contract so unmount cancels the fetch", async () => {
    const unmount = renderHook(client);
    await act(async () => {});

    expect(mocks.getUiState).toHaveBeenCalledTimes(1);
    const args = mocks.getUiState.mock.calls[0][0] as {
      signal?: AbortSignal;
      fetchOptions?: { signal?: AbortSignal };
    };
    expect(args.signal).toBeInstanceOf(AbortSignal);
    expect(args.fetchOptions?.signal).toBe(args.signal);
    unmount();
  });

  it("seeds the UI-state store from the server response", async () => {
    mocks.getUiState.mockResolvedValue({
      status: 200,
      body: { state: { notifications_read: ["a"], language: "ar" } },
    });
    const unmount = renderHook(client);

    // The seed runs in a `useEffect` after the query resolves; poll instead of
    // relying on a single macrotask flush so this stays deterministic under a
    // busy parallel test run.
    await vi.waitFor(() => {
      expect(mocks.initialize).toHaveBeenCalledWith({ notifications_read: ["a"], language: "ar" });
    });
    unmount();
  });

  it("skips the fetch when the store is already initialized", async () => {
    mocks.isInitialized = true;
    const unmount = renderHook(client);
    await act(async () => {});

    expect(mocks.getUiState).not.toHaveBeenCalled();
    expect(mocks.initialize).not.toHaveBeenCalled();
    unmount();
  });
});
