import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { PlatformAuthProvider, usePlatformAuth } from "./PlatformAuthContext";
import { queryClientInstance } from "@/lib/queryClient";
import { apiFetch } from "@/lib/apiClient";

vi.mock("@/lib/contexts/TenantContext", () => ({ useTenant: () => ({ isApex: true }) }));
vi.mock("@/platform/components/PlatformSessionTimeoutWatcher", () => ({
  PlatformSessionTimeoutWatcher: () => null,
}));
vi.mock("@/lib/contexts/authContextHelpers", () => ({ clearPersistedAuthUser: vi.fn() }));
vi.mock("@/lib/apiClient", () => ({
  isApiError: () => false,
  apiFetch: vi.fn(),
  apiJson: vi.fn(async () => ({
    user: { id: "operator-a", role: "super_user", name: "A", email: "a@example.test" },
  })),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

it.each([false, true])(
  "clears cached platform records on logout (request fails: %s)",
  async (fails) => {
    vi.mocked(apiFetch).mockReset();
    if (fails) vi.mocked(apiFetch).mockRejectedValue(new Error("offline"));
    else vi.mocked(apiFetch).mockResolvedValue(new Response());
    let auth: ReturnType<typeof usePlatformAuth>;
    function Consumer() {
      auth = usePlatformAuth();
      return null;
    }
    const container = document.createElement("div");
    const root = createRoot(container);
    try {
      await act(async () =>
        root.render(
          <PlatformAuthProvider>
            <Consumer />
          </PlatformAuthProvider>,
        ),
      );
      queryClientInstance.setQueryData(["platform", "workspaces"], ["operator-a-private-record"]);
      await act(async () => {
        await auth.platformLogout();
      });
      expect(queryClientInstance.getQueryData(["platform", "workspaces"])).toBeUndefined();
    } finally {
      act(() => root.unmount());
      queryClientInstance.clear();
    }
  },
);
