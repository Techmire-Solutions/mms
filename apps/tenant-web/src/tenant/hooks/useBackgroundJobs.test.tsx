import { describe, it, expect, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import type { BackgroundJobRecord } from "@mms/contracts";
import { BACKGROUND_JOBS_QUERY_KEY, useBackgroundJobs } from "./useBackgroundJobs";
import { createTestQueryClient } from "@/test/queryClientTestUtils";

const mocks = vi.hoisted(() => ({
  fetchBackgroundJobs: vi.fn<() => Promise<BackgroundJobRecord[]>>(),
  isAuthenticated: true,
}));

vi.mock("@mms/fe-core/backgroundJobs/api", () => ({
  fetchBackgroundJobs: mocks.fetchBackgroundJobs,
}));
vi.mock("@mms/fe-core/auth/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: mocks.isAuthenticated }),
}));
vi.mock("@mms/fe-core/backgroundJobs", () => ({
  BACKGROUND_JOBS_QUERY_KEY: ["auth", "background-jobs"],
  BACKGROUND_JOBS_EVENT: "mms-background-jobs-changed",
  clearFinishedBackgroundJobs: vi.fn(),
  dismissBackgroundJob: vi.fn(),
  getAllBackgroundJobs: () => [],
  mergeServerBackgroundJobs: (serverJobs: BackgroundJobRecord[]) => serverJobs,
}));

function renderHook(client: QueryClient): () => void {
  function Harness() {
    useBackgroundJobs();
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

describe("useBackgroundJobs", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = createTestQueryClient();
    mocks.fetchBackgroundJobs.mockReset();
    mocks.fetchBackgroundJobs.mockResolvedValue([]);
    mocks.isAuthenticated = true;
  });

  it("scopes the cache key under the auth segment (no IndexedDB persistence)", () => {
    expect(BACKGROUND_JOBS_QUERY_KEY).toEqual(["auth", "background-jobs"]);
  });

  it("does not fetch job lists while the session is unauthenticated", async () => {
    mocks.isAuthenticated = false;
    const unmount = renderHook(client);
    await act(async () => {});

    expect(mocks.fetchBackgroundJobs).not.toHaveBeenCalled();
    unmount();
  });

  it("fetches the server job list through the shared background-jobs API", async () => {
    mocks.fetchBackgroundJobs.mockResolvedValue([
      {
        id: "j1",
        moduleId: "students",
        kind: "export",
        status: "completed",
        label: "CSV",
        createdAt: "2026-11-22T10:00:00Z",
      },
    ]);
    const unmount = renderHook(client);
    await act(async () => {});

    expect(mocks.fetchBackgroundJobs).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("invalidates the job cache when the store dispatches a change event", async () => {
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const unmount = renderHook(client);

    await act(async () => {
      window.dispatchEvent(new CustomEvent("mms-background-jobs-changed"));
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      { queryKey: BACKGROUND_JOBS_QUERY_KEY },
      { cancelRefetch: false },
    );
    unmount();
  });
});
