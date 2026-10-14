import { describe, it, expect, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { usePlatformAiDiagnostics } from "./usePlatformAiDiagnostics";

const apiContractMock = vi.hoisted(() => ({
  platform: { aiQuery: vi.fn() },
}));

vi.mock("@/lib/api", () => ({ apiContract: apiContractMock }));

function renderHook(path = "/platform/dashboard") {
  let hookResult!: ReturnType<typeof usePlatformAiDiagnostics>;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  function TestComponent() {
    hookResult = usePlatformAiDiagnostics();
    return null;
  }

  act(() => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <TestComponent />
      </MemoryRouter>,
    );
  });

  return {
    getResult: () => hookResult,
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("usePlatformAiDiagnostics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("provides route-specific quick prompts", () => {
    const dash = renderHook("/platform/dashboard");
    expect(dash.getResult().quickPrompts).toContain("Check BullMQ queue health");
    dash.cleanup();

    const sys = renderHook("/platform/system");
    expect(sys.getResult().quickPrompts).toContain("Explain connection pool saturation");
    sys.cleanup();

    const ws = renderHook("/platform/workspaces");
    expect(ws.getResult().quickPrompts).toContain("Identify inactive workspaces");
    ws.cleanup();
  });

  it("dispatches prompt and appends assistant response", async () => {
    apiContractMock.platform.aiQuery.mockResolvedValueOnce({
      status: 200,
      body: {
        success: true,
        analysis: "DB pool is operating at 25% utilization.",
        suggestions: [
          { id: "1", label: "Inspect System", actionType: "navigate", target: "/platform/system" },
        ],
        latencyMs: 14,
      },
    });

    const { getResult, cleanup } = renderHook("/platform/system");

    await act(async () => {
      await getResult().askCopilot("Analyze database health");
    });

    const messages = getResult().messages;
    expect(messages.length).toBe(2);
    expect(messages[0].role).toBe("user");
    expect(messages[0].content).toBe("Analyze database health");
    expect(messages[1].role).toBe("assistant");
    expect(messages[1].content).toContain("DB pool is operating");
    expect(messages[1].suggestions?.length).toBe(1);

    cleanup();
  });

  it("surfaces error without inventing assistant health on API failure", async () => {
    apiContractMock.platform.aiQuery.mockRejectedValueOnce(new Error("Network error"));

    const { getResult, cleanup } = renderHook("/platform/dashboard");

    await act(async () => {
      await getResult().askCopilot("Status report");
    });

    const messages = getResult().messages;
    expect(messages.length).toBe(1);
    expect(messages[0].role).toBe("user");
    expect(getResult().error).toBe("Network error");

    act(() => {
      getResult().clearHistory();
    });
    expect(getResult().messages.length).toBe(0);
    expect(getResult().error).toBeNull();

    cleanup();
  });
});
