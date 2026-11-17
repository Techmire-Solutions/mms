import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DEFAULT_GLOBAL_SETTINGS } from "@mms/shared";
import {
  useGlobalSettingsDraft,
  type UseGlobalSettingsDraftResult,
} from "./useGlobalSettingsDraft";

let mockGlobalSettings = { ...DEFAULT_GLOBAL_SETTINGS };
const mockSave = vi.fn().mockResolvedValue({ ok: true, status: 200 });

vi.mock("@/lib/db", () => ({
  getGlobalSettings: () => mockGlobalSettings,
  saveGlobalSettingsAsync: (...args: unknown[]) => mockSave(...args),
}));

vi.mock("@/lib/settingsPreview", () => ({
  previewGlobalSettings: vi.fn(),
  clearGlobalSettingsPreview: vi.fn(),
}));

vi.mock("@/lib/documentLanguage", () => ({
  applyDocumentLanguage: vi.fn(),
}));

vi.mock("@/lib/notify", () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("useGlobalSettingsDraft", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let queryClient: QueryClient;
  let hookResult: UseGlobalSettingsDraftResult;

  function Harness(): null {
    hookResult = useGlobalSettingsDraft();
    return null;
  }

  beforeEach(() => {
    mockGlobalSettings = { ...DEFAULT_GLOBAL_SETTINGS };
    mockSave.mockClear();
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

  it("initializes with persisted baseline and clean dirty state", async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness />
        </QueryClientProvider>,
      );
    });

    expect(hookResult.isGlobalDirty).toBe(false);
    expect(hookResult.isModulesDirty).toBe(false);
    expect(hookResult.data.language).toBe(DEFAULT_GLOBAL_SETTINGS.language);
  });

  it("updates global fields and marks global dirty, then discards", async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness />
        </QueryClientProvider>,
      );
    });

    act(() => {
      hookResult.upd("dateFormat", "YYYY/MM/DD");
    });
    expect(hookResult.isGlobalDirty).toBe(true);

    act(() => {
      hookResult.handleDiscardGlobal();
    });
    expect(hookResult.isGlobalDirty).toBe(false);
    expect(hookResult.data.dateFormat).toBe(DEFAULT_GLOBAL_SETTINGS.dateFormat);
  });

  it("updates modules and marks modules dirty, then discards", async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness />
        </QueryClientProvider>,
      );
    });

    act(() => {
      hookResult.upd("enabledModules", {
        ...DEFAULT_GLOBAL_SETTINGS.enabledModules,
        attendance: false,
      });
    });
    expect(hookResult.isModulesDirty).toBe(true);

    act(() => {
      hookResult.handleDiscardModules();
    });
    expect(hookResult.isModulesDirty).toBe(false);
  });

  it("rejects saving global settings with invalid timezone", async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness />
        </QueryClientProvider>,
      );
    });

    act(() => {
      hookResult.upd("timezone", "Invalid/Timezone");
    });

    let success = false;
    await act(async () => {
      success = await hookResult.handleSaveGlobal();
    });
    expect(success).toBe(false);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("saves global settings successfully when valid", async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness />
        </QueryClientProvider>,
      );
    });

    act(() => {
      hookResult.upd("dateFormat", "YYYY/MM/DD");
    });

    let success = false;
    await act(async () => {
      success = await hookResult.handleSaveGlobal();
    });
    expect(success).toBe(true);
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(hookResult.isGlobalDirty).toBe(false);
  });

  it("saves modules successfully and invalidates query key", async () => {
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness />
        </QueryClientProvider>,
      );
    });

    act(() => {
      hookResult.upd("enabledModules", {
        ...DEFAULT_GLOBAL_SETTINGS.enabledModules,
        attendance: false,
      });
    });

    let success = false;
    await act(async () => {
      success = await hookResult.handleSaveModules();
    });
    expect(success).toBe(true);
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalled();
  });
});
