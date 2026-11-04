import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient, withQueryClient } from "@/test/queryClientTestUtils";

const { updateStatus, update, assertContractOk } = vi.hoisted(() => ({
  updateStatus: vi.fn(),
  update: vi.fn(),
  assertContractOk: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  apiContract: {
    tasks: {
      update: (...args: unknown[]) => update(...args),
      updateStatus: (...args: unknown[]) => updateStatus(...args),
    },
  },
}));
vi.mock("@/lib/apiContractError", () => ({
  assertContractOk: (...args: unknown[]) => assertContractOk(...args),
}));

const { useUpdateTask, useUpdateTaskStatus } = await import("./useTasksApi");

function renderHook<T>(hook: () => T) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const result = { current: undefined as unknown as T };

  function Probe() {
    result.current = hook();
    return null;
  }

  act(() => {
    root.render(withQueryClient(<Probe />, createTestQueryClient()));
  });

  return {
    result,
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("Tasks OCC header wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateStatus.mockResolvedValue({ status: 200, body: { id: "t-1" } });
    update.mockResolvedValue({ status: 200, body: { id: "t-1" } });
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("forwards the version token on a status change", async () => {
    const { result, cleanup } = renderHook(() => useUpdateTaskStatus());
    try {
      await act(async () => {
        await result.current.mutateAsync({
          id: "t-1",
          status: "completed",
          expectedUpdatedAt: "2026-01-01T00:00:00.000Z",
        });
      });
      expect(updateStatus).toHaveBeenCalledWith({
        params: { id: "t-1" },
        body: { status: "completed" },
        extraHeaders: { "x-expected-updated-at": "2026-01-01T00:00:00.000Z" },
      });
    } finally {
      cleanup();
    }
  });

  it("keeps the status change header-free when no token is known", async () => {
    const { result, cleanup } = renderHook(() => useUpdateTaskStatus());
    try {
      await act(async () => {
        await result.current.mutateAsync({ id: "t-1", status: "in_progress" });
      });
      expect(updateStatus).toHaveBeenCalledWith({
        params: { id: "t-1" },
        body: { status: "in_progress" },
      });
    } finally {
      cleanup();
    }
  });

  it("keeps forwarding the version token on a task edit", async () => {
    const { result, cleanup } = renderHook(() => useUpdateTask());
    try {
      await act(async () => {
        await result.current.mutateAsync({
          id: "t-1",
          data: { title: "Renamed" },
          expectedUpdatedAt: "2026-01-02T00:00:00.000Z",
        });
      });
      expect(update).toHaveBeenCalledWith({
        params: { id: "t-1" },
        body: { title: "Renamed" },
        extraHeaders: { "x-expected-updated-at": "2026-01-02T00:00:00.000Z" },
      });
    } finally {
      cleanup();
    }
  });
});
