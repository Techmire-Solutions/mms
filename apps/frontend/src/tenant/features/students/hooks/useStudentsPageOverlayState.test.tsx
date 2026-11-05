import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STUDENT_STATUS_VALUES } from "@mms/shared";

vi.mock("@/hooks/useTranslation", async () => {
  const { useTranslationEnMock } = await import("@/test/useTranslationEnMock");
  return { useTranslation: useTranslationEnMock() };
});

vi.mock("@/hooks/useMessageComposerState", () => ({
  useMessageComposerState: () => ({
    messagingTarget: null,
    openComposer: vi.fn(),
    closeComposer: vi.fn(),
    canWriteMessaging: false,
  }),
}));

import { useStudentsPageOverlayState } from "./useStudentsPageOverlayState";

type OverlayState = ReturnType<typeof useStudentsPageOverlayState>;

describe("useStudentsPageOverlayState", () => {
  let container: HTMLDivElement;
  let root: Root;
  let state: OverlayState;

  function render(statuses?: readonly string[]): void {
    function TestComponent() {
      state = useStudentsPageOverlayState({ statuses });
      return null;
    }
    act(() => {
      root.render(<TestComponent />);
    });
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("builds the bulk-status badge config from the tenant's configured statuses", () => {
    // 2026-11-04 review (S-02): the bulk bar offered the global default statuses, so a
    // tenant-added status could not be bulk-assigned and a removed one was still offered.
    render(["active", "on_leave"]);

    expect(Object.keys(state.statusBadgeConfig)).toEqual(["active", "on_leave"]);
  });

  it("falls back to the shared defaults when the tenant has no configured statuses", () => {
    render(undefined);

    expect(Object.keys(state.statusBadgeConfig)).toEqual([...STUDENT_STATUS_VALUES]);
  });
});
