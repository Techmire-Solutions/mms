import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { usePlatformWorkspaceListActions } from "./usePlatformWorkspaceListActions";
import type { PlatformWorkspaceRow as PlatformWorkspaceRowData } from "@mms/shared";

const mockSetEnabledMutate = vi.fn();
const mockSetEmailMutate = vi.fn();

vi.mock("@/platform/hooks/usePlatformWorkspaces", () => ({
  useSetWorkspaceEnabled: () => ({
    mutate: mockSetEnabledMutate,
    isPending: false,
  }),
  useSetWorkspaceEmailVerification: () => ({
    mutate: mockSetEmailMutate,
    isPending: false,
  }),
}));

describe("usePlatformWorkspaceListActions", () => {
  it("exposes expected action methods on the hook", () => {
    let capturedActions: ReturnType<typeof usePlatformWorkspaceListActions> | null = null;
    function Capture() {
      capturedActions = usePlatformWorkspaceListActions();
      return null;
    }
    renderToStaticMarkup(React.createElement(Capture));

    expect(capturedActions).not.toBeNull();
    expect(typeof capturedActions!.handleToggleEnabled).toBe("function");
    expect(typeof capturedActions!.handleToggleEmailVerification).toBe("function");
    expect(typeof capturedActions!.handleBulkEnable).toBe("function");
    expect(typeof capturedActions!.handleBulkDisable).toBe("function");
    expect(capturedActions!.togglePending).toBe(false);

    // Call handlers
    capturedActions!.handleToggleEnabled("demo", true);
    expect(mockSetEnabledMutate).toHaveBeenCalledWith({ subdomain: "demo", enabled: true });

    capturedActions!.handleToggleEmailVerification("demo", true);
    expect(mockSetEmailMutate).toHaveBeenCalledWith({
      subdomain: "demo",
      requireEmailVerification: true,
    });

    const items: PlatformWorkspaceRowData[] = [
      { subdomain: "ws1", madrasaName: "W1", enabled: false, createdAt: "2026-01-01" },
      { subdomain: "ws2", madrasaName: "W2", enabled: true, createdAt: "2026-01-01" },
    ];

    capturedActions!.handleBulkEnable(items);
    expect(mockSetEnabledMutate).toHaveBeenCalledWith({ subdomain: "ws1", enabled: true });

    mockSetEnabledMutate.mockClear();
    capturedActions!.handleBulkDisable(items);
    expect(mockSetEnabledMutate).toHaveBeenCalledWith({ subdomain: "ws2", enabled: false });
  });
});
