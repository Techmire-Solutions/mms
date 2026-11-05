import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StandardMessagingRecipient as MessagingRecipient } from "@mms/shared";
import { notify } from "@/lib/notify";
import { useComposerRecipients, type ComposerRecipientsState } from "./useComposerRecipients";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/lib/notify", () => ({
  notify: {
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

const t = ((key: string) => key) as unknown as Parameters<typeof useComposerRecipients>[1];

function recipient(id: string): MessagingRecipient {
  return { id, name: id, phone: `+92300${id}` };
}

describe("useComposerRecipients", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let state: ComposerRecipientsState;

  beforeEach(() => {
    vi.mocked(notify.success).mockClear();
    vi.mocked(notify.warning).mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    function Host(): React.JSX.Element | null {
      state = useComposerRecipients([recipient("c1")], t);
      return null;
    }
    act(() => {
      root.render(<Host />);
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("adds a batch with one summary toast and skips duplicates", () => {
    act(() => {
      state.addRecipients([recipient("c1"), recipient("c2"), recipient("c3"), recipient("c2")]);
    });

    expect(state.localRecipients.map((r) => r.id)).toEqual(["c1", "c2", "c3"]);
    expect(notify.success).toHaveBeenCalledTimes(1);
    expect(vi.mocked(notify.success).mock.calls[0]?.[0]).toBe("messaging.recipientsAdded");
  });

  it("warns instead of duplicating a single add", () => {
    act(() => {
      state.addRecipient(recipient("c1"));
    });

    expect(state.localRecipients).toHaveLength(1);
    expect(notify.warning).toHaveBeenCalledWith("messaging.recipientAlreadyAdded");
  });

  it("removes a batch with one summary toast", () => {
    act(() => {
      state.addRecipients([recipient("c2")]);
    });
    vi.mocked(notify.success).mockClear();

    act(() => {
      state.removeRecipients(["c1", "c2"]);
    });

    expect(state.localRecipients).toHaveLength(0);
    expect(notify.success).toHaveBeenCalledTimes(1);
    expect(vi.mocked(notify.success).mock.calls[0]?.[0]).toBe("messaging.recipientsRemoved");
  });
});
