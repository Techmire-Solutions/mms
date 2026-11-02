import React, { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { useTemplateSaveConflict } from "./useTemplateSaveConflict";
import { notify } from "@/lib/notify";
import { withQueryClient } from "@/test/queryClientTestUtils";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

vi.mock("@/lib/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const t = ((key: string) => key) as unknown as TranslationFunction;
const conflict = Object.assign(new Error("conflict"), {
  name: "DocumentTemplateConflictError",
});

let state!: ReturnType<typeof useTemplateSaveConflict>;
function Probe() {
  state = useTemplateSaveConflict("test_key", t);
  return null;
}

describe("useTemplateSaveConflict", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports a conflict once and blocks further saves", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => root.render(withQueryClient(<Probe />)));

    act(() => {
      expect(state.handleSaveError(conflict)).toBe(true);
    });
    expect(state.blocked).toBe(true);
    expect(notify.error).toHaveBeenCalledTimes(1);

    act(() => {
      expect(state.handleSaveError(conflict)).toBe(true);
    });
    expect(notify.error).toHaveBeenCalledTimes(1);

    act(() => {
      expect(state.handleSaveError(new Error("other"))).toBe(false);
    });
    expect(state.blocked).toBe(true);

    await act(async () => {
      await root.unmount();
    });
    container.remove();
  });

  it("clears the conflict and bumps the remount nonce on reload", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => root.render(withQueryClient(<Probe />)));

    act(() => state.handleSaveError(conflict));
    const before = state.reloadNonce;

    await act(async () => {
      await state.reload();
    });

    expect(state.blocked).toBe(false);
    expect(state.reloadNonce).toBe(before + 1);

    await act(async () => {
      await root.unmount();
    });
    container.remove();
  });
});
