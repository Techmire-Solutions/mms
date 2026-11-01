import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi, afterEach } from "vitest";
import { useMessageComposerModel } from "./useMessageComposerModel";
import { clearComposerDraft } from "./messageComposerDraft";
import type { MessageTemplate } from "@mms/shared";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/hooks/useMessaging", () => ({
  useMessageTemplates: () => ({
    templates: [],
  }),
}));

vi.mock("@/lib/notify", () => ({
  notify: {
    info: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("./useMessageComposerDispatch", () => ({
  useMessageComposerDispatch: () => ({
    eligibleRecipients: [],
    skippedRecipients: [],
    validatedRecipients: [],
    sendAll: vi.fn(),
    opening: false,
    saving: false,
    dispatchProgress: null,
    isPaused: false,
    dispatchSpeed: "fast" as const,
    setIsPaused: vi.fn(),
    setDispatchSpeed: vi.fn(),
    cancelDispatch: vi.fn(),
    pendingAudit: false,
  }),
}));

function renderHookInDom<P, R>(hookFn: (props: P) => R, initialProps: P) {
  let result!: R;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  function Wrapper({ props }: { props: P }) {
    result = hookFn(props);
    return null;
  }

  const rerenderFn = (nextProps: P) => {
    act(() => {
      root.render(<Wrapper props={nextProps} />);
    });
  };

  act(() => {
    root.render(<Wrapper props={initialProps} />);
  });

  return {
    getResult: () => result,
    rerender: rerenderFn,
    cleanup: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

const MOCK_TEMPLATE: MessageTemplate = {
  id: "tpl-1",
  channel: "whatsapp",
  label: "Default Greeting",
  body: "Assalamu alaikum {name}",
  category: "general",
};

describe("useMessageComposerModel", () => {
  afterEach(() => {
    clearComposerDraft("whatsapp", "test-user");
  });

  it("is NOT dirty when opened fresh with empty recipients and default template", () => {
    const { getResult, cleanup } = renderHookInDom((props) => useMessageComposerModel(props), {
      channel: "whatsapp" as const,
      recipients: [],
      templates: [MOCK_TEMPLATE],
      onClose: vi.fn(),
      user: { id: "test-user" },
    });

    try {
      const model = getResult();
      expect(model.step).toBe("pick");
      expect(model.localRecipients).toHaveLength(0);
      expect(model.message).toBe("Assalamu alaikum {name}");
      // Key invariant: Pristine state must NOT be dirty so Escape dismisses cleanly
      expect(model.isDirty).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("becomes dirty when a recipient is added on the pick step", () => {
    const { getResult, cleanup } = renderHookInDom((props) => useMessageComposerModel(props), {
      channel: "whatsapp" as const,
      recipients: [],
      templates: [MOCK_TEMPLATE],
      onClose: vi.fn(),
      user: { id: "test-user" },
    });

    try {
      expect(getResult().isDirty).toBe(false);

      act(() => {
        getResult().addRecipient({
          id: "rec-1",
          name: "Ali",
          phone: "+1234567890",
        });
      });

      expect(getResult().isDirty).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("is NOT dirty when opened with pre-filled recipient until user edits message", () => {
    const { getResult, cleanup } = renderHookInDom((props) => useMessageComposerModel(props), {
      channel: "whatsapp" as const,
      recipients: [{ id: "rec-1", name: "Ali", phone: "+1234567890" }],
      templates: [MOCK_TEMPLATE],
      onClose: vi.fn(),
      user: { id: "test-user" },
    });

    try {
      const model = getResult();
      expect(model.step).toBe("compose");
      expect(model.isDirty).toBe(false);

      act(() => {
        model.setMessage("Custom edited message");
      });

      expect(getResult().isDirty).toBe(true);
    } finally {
      cleanup();
    }
  });
});
