import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTenantDatabaseUpdates } from "./useTenantDatabaseUpdates";
import type { BackgroundJobEventMessage } from "@mms/shared";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockAuth = { isAuthenticated: true, authChecked: true };
vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => mockAuth,
}));

let capturedHandlers: {
  onDatabaseUpdate: (msg: {
    event: "database-update";
    type: "collection" | "object";
    key: string;
  }) => void;
  onJobEvent?: (msg: BackgroundJobEventMessage) => void;
} | null = null;

const mockDisconnect = vi.fn();
vi.mock("@/lib/tenantWebSocket", () => ({
  connectTenantDatabaseSocket: (handlers: typeof capturedHandlers) => {
    capturedHandlers = handlers;
    return mockDisconnect;
  },
}));

const mockPatch = vi.fn();
const mockUpsert = vi.fn();
vi.mock("@/lib/backgroundJobs/backgroundJobStore", () => ({
  patchLocalBackgroundJobOnly: (...args: unknown[]) => mockPatch(...args),
  upsertLocalBackgroundJob: (...args: unknown[]) => mockUpsert(...args),
}));

const mockFetchBackgroundJob = vi.fn();
vi.mock("@/lib/backgroundJobs/pollBackgroundJob", () => ({
  fetchBackgroundJob: (...args: unknown[]) => mockFetchBackgroundJob(...args),
}));

const mockReportClientError = vi.fn();
vi.mock("@/lib/clientErrorReporting", () => ({
  reportClientError: (...args: unknown[]) => mockReportClientError(...args),
}));

describe("useTenantDatabaseUpdates", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.isAuthenticated = true;
    mockAuth.authChecked = true;
    capturedHandlers = null;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  function renderHook() {
    function TestComponent() {
      useTenantDatabaseUpdates();
      return null;
    }

    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestComponent />
        </QueryClientProvider>,
      );
    });
  }

  it("does not connect socket if not authenticated", () => {
    mockAuth.isAuthenticated = false;
    renderHook();
    expect(capturedHandlers).toBeNull();
  });

  it("connects socket and handles job-progress event", () => {
    mockPatch.mockReturnValue(true);
    renderHook();
    expect(capturedHandlers).not.toBeNull();

    act(() => {
      capturedHandlers?.onJobEvent?.({
        event: "job-progress",
        tenantId: "tenant-1",
        jobId: "job-101",
        progress: { current: 10, total: 100, percent: 10 },
      });
    });

    expect(mockPatch).toHaveBeenCalledWith(
      "job-101",
      expect.objectContaining({
        status: "running",
      }),
    );
    expect(mockFetchBackgroundJob).not.toHaveBeenCalled();
  });

  it("reports error when fetchBackgroundJob fails on job-completed event", async () => {
    mockPatch.mockReturnValue(false);
    const fetchErr = new Error("Network failure");
    mockFetchBackgroundJob.mockRejectedValue(fetchErr);

    renderHook();

    await act(async () => {
      capturedHandlers?.onJobEvent?.({
        event: "job-completed",
        tenantId: "tenant-1",
        jobId: "job-202",
        moduleId: "students",
      });
    });

    expect(mockFetchBackgroundJob).toHaveBeenCalledWith("job-202");
    expect(mockReportClientError).toHaveBeenCalledWith(fetchErr, {
      context: "useTenantDatabaseUpdates.fetchJob",
      jobId: "job-202",
    });
  });

  it("disconnects socket on unmount", async () => {
    renderHook();
    expect(capturedHandlers).not.toBeNull();

    await act(async () => {
      root.unmount();
    });

    expect(mockDisconnect).toHaveBeenCalled();
  });
});
