import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { permissions, notifyError } = vi.hoisted(() => ({
  permissions: { canWrite: true },
  notifyError: vi.fn(),
}));

vi.mock("@/tenant/hooks/usePermissions", () => ({
  useModulePermissions: () => ({ canWrite: permissions.canWrite }),
}));
vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/notify", () => ({
  notify: {
    error: (...args: unknown[]) => notifyError(...args),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

import { useMessageComposerState } from "./useMessageComposerState";

interface Api {
  openComposer: ReturnType<typeof useMessageComposerState>["openComposer"];
  target: ReturnType<typeof useMessageComposerState>["messagingTarget"];
}

describe("useMessageComposerState", () => {
  let api: Api;

  beforeEach(() => {
    permissions.canWrite = true;
    notifyError.mockReset();
    api = { openComposer: () => undefined, target: null };
  });

  function renderHost() {
    const container = document.createElement("div");
    const root = createRoot(container);
    function Host() {
      const state = useMessageComposerState();
      api = { openComposer: state.openComposer, target: state.messagingTarget };
      return null;
    }
    act(() => {
      root.render(<Host />);
    });
    return root;
  }

  it("opens the composer for a writable role", () => {
    const root = renderHost();

    act(() => {
      api.openComposer("sms", [{ id: "c-1", name: "Ali", phone: "+923001234567" }]);
    });

    expect(api.target).toEqual(
      expect.objectContaining({
        channel: "sms",
        recipients: [expect.objectContaining({ id: "c-1" })],
      }),
    );
    expect(notifyError).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it("dedupes repeated contacts before handing them to the composer", () => {
    const root = renderHost();

    act(() => {
      api.openComposer("sms", [
        { id: "c-1", name: "Guardian", phone: "+923001234567" },
        { id: "c-1", name: "Guardian", phone: "+923001234567" },
        { id: "c-2", name: "Zaid", phone: "+923001234568" },
      ]);
    });

    // Resending two logs to the same guardian must not message them twice.
    expect(api.target?.recipients.map((r) => r.id)).toEqual(["c-1", "c-2"]);
    expect(notifyError).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it("gates through the messaging module manifest and denies read-only roles", () => {
    permissions.canWrite = false;
    const root = renderHost();

    act(() => {
      api.openComposer("sms", [{ id: "c-1", name: "Ali", phone: "+923001234567" }]);
    });

    expect(api.target).toBeNull();
    expect(notifyError).toHaveBeenCalledWith("messaging.writeDenied");
    act(() => root.unmount());
  });
});
