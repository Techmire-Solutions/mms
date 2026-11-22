import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider, keepPreviousData, type QueryClient } from "@tanstack/react-query";
import {
  AUDIT_EVENTS_QUERY_KEY,
  AUDIT_MERKLE_ROOTS_QUERY_KEY,
  AUDIT_ANOMALIES_QUERY_KEY,
  auditEventsQueryOptions,
  useAuditEventsQuery,
  useAuditMerkleRootsQuery,
  useAuditAnomaliesQuery,
  useAuditVerifyMutation,
} from "./audit";
import { createTestQueryClient } from "@/test/queryClientTestUtils";

const apiContractMock = vi.hoisted(() => ({
  audit: {
    listEvents: vi.fn().mockResolvedValue({ status: 200, body: {} }),
    listMerkleRoots: vi.fn().mockResolvedValue({ status: 200, body: {} }),
    getAnomalies: vi.fn().mockResolvedValue({ status: 200, body: {} }),
    verifyChain: vi.fn().mockResolvedValue({ status: 200, body: {} }),
    executeErasure: vi.fn().mockResolvedValue({ status: 200, body: {} }),
  },
}));

let mockIsAuthenticated = true;

vi.mock("@/lib/api", () => ({ apiContract: apiContractMock }));
vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: mockIsAuthenticated }),
}));

function renderHook<T>(useHook: () => T, client: QueryClient): { result: T; unmount: () => void } {
  let result!: T;
  function Harness() {
    result = useHook();
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
  return { result, unmount: () => act(() => root.unmount()) };
}

describe("auditEventsQueryOptions", () => {
  beforeEach(() => {
    apiContractMock.audit.listEvents.mockClear();
    mockIsAuthenticated = true;
  });

  it("targets the unfiltered events endpoint with the shared query key", async () => {
    const options = auditEventsQueryOptions();
    expect(options.queryKey).toEqual([...AUDIT_EVENTS_QUERY_KEY, {}]);
    expect(options.staleTime).toBe(30_000);

    const signal = new AbortController().signal;
    await (options.queryFn as (ctx: { signal: AbortSignal }) => Promise<unknown>)({ signal });

    expect(apiContractMock.audit.listEvents).toHaveBeenCalledWith(
      expect.objectContaining({ query: {}, signal }),
    );
  });

  it("serializes active filters into the request query", async () => {
    const options = auditEventsQueryOptions({ limit: 10, offset: 20, tableName: "students" });

    const signal = new AbortController().signal;
    await (options.queryFn as (ctx: { signal: AbortSignal }) => Promise<unknown>)({ signal });

    expect(apiContractMock.audit.listEvents).toHaveBeenCalledWith(
      expect.objectContaining({ query: { limit: 10, offset: 20, tableName: "students" } }),
    );
  });

  it("scopes every audit cache key under the auth segment so it never persists to IndexedDB", () => {
    expect(AUDIT_EVENTS_QUERY_KEY[0]).toBe("auth");
    expect(AUDIT_MERKLE_ROOTS_QUERY_KEY[0]).toBe("auth");
    expect(AUDIT_ANOMALIES_QUERY_KEY[0]).toBe("auth");
  });

  it("keeps the previous page rendered while paginating", () => {
    const options = auditEventsQueryOptions({ limit: 25, offset: 0 });
    expect(options.placeholderData).toBe(keepPreviousData);
  });

  it("honours an explicit enabled gate and defaults to enabled", () => {
    expect(auditEventsQueryOptions({}, { enabled: false }).enabled).toBe(false);
    expect(auditEventsQueryOptions().enabled).toBe(true);
  });
});

describe("audit query hooks gate on authentication", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = createTestQueryClient();
    apiContractMock.audit.listEvents.mockClear();
    apiContractMock.audit.listMerkleRoots.mockClear();
    apiContractMock.audit.getAnomalies.mockClear();
  });

  afterEach(() => {
    mockIsAuthenticated = true;
  });

  it("does not fetch any audit data while the session is unauthenticated", async () => {
    // Regression: an unauthenticated shell mount fired /api/audit requests
    // (401s) because none of the audit queries were gated by the session.
    mockIsAuthenticated = false;
    const { unmount } = renderHook(() => {
      useAuditEventsQuery();
      useAuditMerkleRootsQuery();
      useAuditAnomaliesQuery();
    }, client);
    await act(async () => {});

    expect(apiContractMock.audit.listEvents).not.toHaveBeenCalled();
    expect(apiContractMock.audit.listMerkleRoots).not.toHaveBeenCalled();
    expect(apiContractMock.audit.getAnomalies).not.toHaveBeenCalled();
    unmount();
  });

  it("fetches audit data once authenticated", async () => {
    const { unmount } = renderHook(() => {
      useAuditEventsQuery();
      useAuditMerkleRootsQuery();
      useAuditAnomaliesQuery();
    }, client);
    await act(async () => {});

    expect(apiContractMock.audit.listEvents).toHaveBeenCalledTimes(1);
    expect(apiContractMock.audit.listMerkleRoots).toHaveBeenCalledTimes(1);
    expect(apiContractMock.audit.getAnomalies).toHaveBeenCalledTimes(1);
    unmount();
  });
});

describe("useAuditVerifyMutation", () => {
  it("awaits cache invalidation so completion implies refreshed audit data", async () => {
    // Regression: onSuccess fired `void invalidateQueries(...)`; `mutateAsync`
    // resolved before the cache invalidation was scheduled, so a caller closing
    // the panel on completion could read stale audit rows.
    const client = createTestQueryClient();
    let releaseInvalidation!: () => void;
    const invalidationDone = new Promise<void>((resolve) => {
      releaseInvalidation = resolve;
    });
    const invalidateSpy = vi
      .spyOn(client, "invalidateQueries")
      .mockReturnValueOnce(invalidationDone as never);

    const { result, unmount } = renderHook(() => useAuditVerifyMutation(), client);
    let settled = false;
    const mutation = result.mutateAsync().then(() => {
      settled = true;
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(settled).toBe(false);

    releaseInvalidation();
    await act(async () => {
      await mutation;
    });
    expect(settled).toBe(true);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: AUDIT_EVENTS_QUERY_KEY });
    unmount();
  });
});
