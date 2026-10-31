import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthSessionSync } from "./useAuthSessionSync";
import { AUTH_USER_STORAGE_KEY } from "./authContextHelpers";
import { getWorkspaceLocalStoragePrefix } from "@/lib/dbStorageCore";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { clearCache } = vi.hoisted(() => ({ clearCache: vi.fn() }));

vi.mock("@/lib/queryClient", () => ({
  queryClientInstance: { clear: clearCache, sessionRevision: 0 },
}));

vi.mock("@/lib/config/tenantConfig", () => ({
  isCurrentHostApex: () => true,
  getCurrentSubdomain: () => "test",
}));

function Harness(): null {
  useAuthSessionSync({
    setUser: vi.fn(),
    setIsAuthenticated: vi.fn(),
    setAuthChecked: vi.fn(),
    setIsLoadingAuth: vi.fn(),
    setAuthError: vi.fn(),
    applyAuthSession: vi.fn().mockResolvedValue(undefined),
    userRef: { current: null },
  });
  return null;
}

describe("useAuthSessionSync", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    clearCache.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    localStorage.clear();
  });

  it("given another tab signs out, should clear that user's scoped caches when the storage event arrives", async () => {
    // Arrange
    const prefix = getWorkspaceLocalStoragePrefix();
    const messagesKey = `${prefix}messages`;
    const templatesKey = `${prefix}whatsappTemplates_u:user-1`;
    localStorage.setItem(messagesKey, "cached-thread");
    localStorage.setItem(templatesKey, "cached-template");

    await act(async () => {
      root.render(<Harness />);
    });

    // Act
    await act(async () => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: AUTH_USER_STORAGE_KEY,
          oldValue: JSON.stringify({ id: "user-1", workspaceSubdomain: "test" }),
          newValue: null,
        }),
      );
    });

    // Assert
    expect(clearCache).toHaveBeenCalled();
    expect(localStorage.getItem(messagesKey)).toBeNull();
    expect(localStorage.getItem(templatesKey)).toBeNull();
  });
});
