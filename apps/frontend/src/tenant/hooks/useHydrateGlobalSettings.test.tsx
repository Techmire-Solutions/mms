import { describe, it, expect, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { DEFAULT_GLOBAL_SETTINGS } from "@mms/contracts";
import { mergeServerLocalization } from "@/lib/globalSettingsHydration";
import { useHydrateGlobalSettings } from "./useHydrateGlobalSettings";

const mocks = vi.hoisted(() => ({
  hydrateGlobalSettingsFromServer: vi.fn<() => Promise<void>>(),
  isAuthenticated: true,
  authChecked: true,
  subdomain: "demo",
  workspace: { subdomain: "demo" },
}));

vi.mock("@/lib/globalSettingsHydration", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/globalSettingsHydration")>();
  return { ...actual, hydrateGlobalSettingsFromServer: mocks.hydrateGlobalSettingsFromServer };
});
vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: mocks.isAuthenticated, authChecked: mocks.authChecked }),
}));
vi.mock("@/lib/contexts/TenantContext", () => ({
  useTenant: () => ({
    isApex: false,
    subdomain: mocks.subdomain,
    workspace: mocks.workspace,
  }),
}));
vi.mock("react-router-dom", () => ({
  useLocation: () => ({ pathname: "/" }),
}));

function renderHook(strict = false): { result: () => boolean; unmount: () => void } {
  let isHydrating = false;
  function Harness() {
    isHydrating = useHydrateGlobalSettings().isHydrating;
    return null;
  }
  const div = document.createElement("div");
  const root = createRoot(div);
  act(() => {
    root.render(strict ? <React.StrictMode>{<Harness />}</React.StrictMode> : <Harness />);
  });
  return {
    result: () => isHydrating,
    unmount: () => act(() => root.unmount()),
  };
}

describe("useHydrateGlobalSettings", () => {
  beforeEach(() => {
    mocks.hydrateGlobalSettingsFromServer.mockReset();
    mocks.hydrateGlobalSettingsFromServer.mockResolvedValue(undefined);
    mocks.isAuthenticated = true;
    mocks.authChecked = true;
    mocks.subdomain = `demo-${crypto.randomUUID()}`;
  });

  it("does not hydrate while the session is unauthenticated", async () => {
    mocks.isAuthenticated = false;
    const { result, unmount } = renderHook();
    await act(async () => {});

    expect(mocks.hydrateGlobalSettingsFromServer).not.toHaveBeenCalled();
    expect(result()).toBe(false);
    unmount();
  });

  it("hydrates once and reports the pending state until it settles", async () => {
    let release!: () => void;
    mocks.hydrateGlobalSettingsFromServer.mockReturnValue(
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    );

    const { result, unmount } = renderHook();
    await act(async () => {});
    expect(mocks.hydrateGlobalSettingsFromServer).toHaveBeenCalledTimes(1);
    expect(result()).toBe(true);

    await act(async () => {
      release();
    });
    expect(result()).toBe(false);
    unmount();
  });

  it("keeps a StrictMode remount single-flight", async () => {
    // Regression: the module-level "hydrated" set only dedupes after the fetch
    // settles, so StrictMode's mount/unmount/mount ran two concurrent
    // hydrations; the second could clobber the first's localization merge.
    const { unmount } = renderHook(true);
    await act(async () => {});

    expect(mocks.hydrateGlobalSettingsFromServer).toHaveBeenCalledTimes(1);
    unmount();
  });
});

describe("mergeServerLocalization", () => {
  it("adopts server localization fields without dropping local preferences", () => {
    const merged = mergeServerLocalization(
      { ...DEFAULT_GLOBAL_SETTINGS, language: "en", llmApiKey: "local-secret" },
      { language: "ar", timezone: "Asia/Riyadh", dateFormat: "YYYY-MM-DD" },
    );

    expect(merged.language).toBe("ar");
    expect(merged.timezone).toBe("Asia/Riyadh");
    expect(merged.dateFormat).toBe("YYYY-MM-DD");
    expect(merged.llmApiKey).toBe("local-secret");
  });

  it("keeps local settings when the server payload is unavailable", () => {
    const current = { ...DEFAULT_GLOBAL_SETTINGS, language: "ur" as const };
    expect(mergeServerLocalization(current, null)).toEqual(current);
  });
});
