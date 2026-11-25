import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useObligationsCollections } from "./useObligationsApi";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const authState = vi.hoisted(() => ({ isAuthenticated: true }));

vi.mock("@mms/fe-core/auth/AuthContext", () => ({
  useAuth: () => authState,
}));

vi.mock("@/tenant/features/obligations/hooks/useObligationsMutations", () => ({
  useObligationsMutations: () => ({}),
}));

vi.mock("@mms/fe-core/hooks", () => ({
  serverMetricsQueryOptions: () => ({}),
  useServerMetrics: () => ({}),
}));

vi.mock("@mms/fe-core/api/tsRest", async () => {
  const { useQuery: tsQuery } = await import("@tanstack/react-query");
  return {
    tsrClient: {
      obligations: {
        listCollections: {
          useQuery: (options: { queryKey: unknown[]; enabled?: boolean; staleTime?: number }) =>
            tsQuery({
              queryKey: options.queryKey,
              queryFn: () =>
                Promise.resolve({
                  status: 200,
                  body: { collections: [] },
                  headers: new Headers(),
                }),
              enabled: options.enabled,
              staleTime: options.staleTime,
            }),
        },
      },
    },
  };
});

type CollectionsResult = ReturnType<typeof useObligationsCollections>;

function renderCollectionsHook(options?: { enabled?: boolean; includeDeleted?: boolean }) {
  let result!: CollectionsResult;
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  function Probe() {
    result = useObligationsCollections(options);
    return null;
  }

  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>,
    );
  });

  return {
    getResult: () => result,
    flush: () =>
      act(async () => {
        await vi.waitFor(
          () => {
            expect(result.fetchStatus).not.toBe("fetching");
          },
          { timeout: 1_000 },
        );
      }),
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
      queryClient.clear();
    },
  };
}

describe("useObligationsCollections", () => {
  beforeEach(() => {
    authState.isAuthenticated = true;
  });

  it("runs the list query by default for an authenticated user", async () => {
    const { getResult, flush, cleanup } = renderCollectionsHook();
    await flush();
    expect(getResult().status).toBe("success");
    cleanup();
  });

  it("honours the enabled option: enabled:false never fetches", async () => {
    const { getResult, flush, cleanup } = renderCollectionsHook({ enabled: false });
    await flush();
    expect(getResult().fetchStatus).toBe("idle");
    expect(getResult().status).toBe("pending");
    cleanup();
  });

  it("stays idle while unauthenticated, even without an explicit enabled option", async () => {
    authState.isAuthenticated = false;
    const { getResult, flush, cleanup } = renderCollectionsHook();
    await flush();
    expect(getResult().fetchStatus).toBe("idle");
    expect(getResult().status).toBe("pending");
    cleanup();
  });
});
