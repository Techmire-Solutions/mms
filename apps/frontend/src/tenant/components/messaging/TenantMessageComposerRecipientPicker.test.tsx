import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StandardMessagingRecipient } from "@mms/shared";
import { TenantMessageComposerRecipientPicker } from "./TenantMessageComposerRecipientPicker";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const recipients: StandardMessagingRecipient[] = [
  { id: "c1", name: "Zaid Khan", phone: "+923001234567", email: "zaid@example.com" },
];

vi.mock("@/tenant/features/messaging/hooks/useMessagingWorkRecipients", () => ({
  useMessagingWorkRecipients: () => ({
    recipients,
    page: 1,
    total: recipients.length,
    limit: 50,
    hasMore: false,
    isError: false,
    isPending: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params?.name ? `${key}:${params.name}` : key,
  }),
}));

describe("TenantMessageComposerRecipientPicker", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("renders the lean recipients from the hook", async () => {
    await act(async () => {
      root.render(
        <TenantMessageComposerRecipientPicker
          kind="phone"
          existingIds={new Set()}
          onAdd={vi.fn()}
          onRemove={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain("Zaid Khan");
    expect(container.textContent).toContain("+923001234567");
  });

  it("adds a recipient when its row checkbox is toggled", async () => {
    const onAdd = vi.fn();
    await act(async () => {
      root.render(
        <TenantMessageComposerRecipientPicker
          kind="phone"
          existingIds={new Set()}
          onAdd={onAdd}
          onRemove={vi.fn()}
        />,
      );
    });

    const checkboxes = container.querySelectorAll<HTMLButtonElement>('button[role="checkbox"]');
    expect(checkboxes.length).toBeGreaterThanOrEqual(2);
    await act(async () => {
      checkboxes[1]?.click();
    });

    expect(onAdd).toHaveBeenCalledWith(recipients[0]);
  });
});
