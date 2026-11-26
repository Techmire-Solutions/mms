import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StandardMessagingRecipient } from "@mms/contracts";
import { notify } from "@mms/fe-core/notify";
import { TenantMessageComposerRecipientPicker } from "./TenantMessageComposerRecipientPicker";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const recipients: StandardMessagingRecipient[] = [
  { id: "c1", name: "Zaid Khan", phone: "+923001234567", email: "zaid@example.com" },
  { id: "c2", name: "Hira Baig", phone: "+923001234568", email: "hira@example.com" },
  { id: "c3", name: "Ali Raza", phone: "+923001234569", email: "ali@example.com" },
];

const matchRecipients = vi.fn();

vi.mock("@mms/fe-core/api/tsRest", () => ({
  apiContract: { messaging: { matchRecipients: (...args: unknown[]) => matchRecipients(...args) } },
}));

vi.mock("@mms/fe-core/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@mms/mod-messaging/frontend/tenant/hooks/useMessagingWorkRecipients", () => ({
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

vi.mock("@mms/fe-core/i18n", () => ({
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

  it("adds every matched recipient with one batch call instead of one page", async () => {
    const onAdd = vi.fn();
    const onAddMany = vi.fn();
    matchRecipients.mockResolvedValueOnce({
      status: 200,
      body: { recipients, total: recipients.length, truncated: false, limit: 10_000 },
    });
    await act(async () => {
      root.render(
        <TenantMessageComposerRecipientPicker
          kind="phone"
          existingIds={new Set()}
          onAdd={onAdd}
          onRemove={vi.fn()}
          onAddMany={onAddMany}
          onRemoveMany={vi.fn()}
        />,
      );
    });

    const checkboxes = container.querySelectorAll<HTMLButtonElement>('button[role="checkbox"]');
    // First checkbox is the select-all header cell.
    await act(async () => {
      checkboxes[0]?.click();
    });

    expect(matchRecipients).toHaveBeenCalledWith({
      query: { role: "all", gender: "all", kind: "phone" },
    });
    expect(onAddMany).toHaveBeenCalledTimes(1);
    expect(onAddMany.mock.calls[0]?.[0]).toHaveLength(recipients.length);
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("select-all adds all 120 matched recipients rather than the visible page of 50", async () => {
    const onAddMany = vi.fn();
    const matched = Array.from({ length: 120 }, (_, index) => ({
      id: `m${index + 1}`,
      name: `Recipient ${index + 1}`,
      phone: `+9230000${String(index).padStart(5, "0")}`,
    }));
    matchRecipients.mockResolvedValueOnce({
      status: 200,
      body: { recipients: matched, total: matched.length, truncated: false, limit: 10_000 },
    });
    await act(async () => {
      root.render(
        <TenantMessageComposerRecipientPicker
          kind="phone"
          existingIds={new Set()}
          onAdd={vi.fn()}
          onRemove={vi.fn()}
          onAddMany={onAddMany}
          onRemoveMany={vi.fn()}
        />,
      );
    });

    const selectAll = container.querySelector<HTMLButtonElement>('button[role="checkbox"]');
    await act(async () => {
      selectAll?.click();
    });

    expect(onAddMany).toHaveBeenCalledTimes(1);
    expect(onAddMany.mock.calls[0]?.[0]).toHaveLength(120);
  });

  it("shows the select-all failure banner and toast when matching fails", async () => {
    const onAddMany = vi.fn();
    matchRecipients.mockResolvedValueOnce({
      status: 500,
      body: { type: "database_error", message: "Failed to match recipients" },
    });
    await act(async () => {
      root.render(
        <TenantMessageComposerRecipientPicker
          kind="phone"
          existingIds={new Set()}
          onAdd={vi.fn()}
          onRemove={vi.fn()}
          onAddMany={onAddMany}
          onRemoveMany={vi.fn()}
        />,
      );
    });

    const selectAll = container.querySelector<HTMLButtonElement>('button[role="checkbox"]');
    await act(async () => {
      selectAll?.click();
    });

    expect(onAddMany).not.toHaveBeenCalled();
    expect(container.textContent).toContain("messaging.selectAllFailed");
    expect(notify.error).toHaveBeenCalledWith("messaging.selectAllFailed");
  });

  it("removes the whole page with one batch call when everything is selected", async () => {
    const onRemove = vi.fn();
    const onRemoveMany = vi.fn();
    await act(async () => {
      root.render(
        <TenantMessageComposerRecipientPicker
          kind="phone"
          existingIds={new Set(recipients.map((r) => String(r.id)))}
          onAdd={vi.fn()}
          onRemove={onRemove}
          onAddMany={vi.fn()}
          onRemoveMany={onRemoveMany}
        />,
      );
    });

    const checkboxes = container.querySelectorAll<HTMLButtonElement>('button[role="checkbox"]');
    await act(async () => {
      checkboxes[0]?.click();
    });

    expect(onRemoveMany).toHaveBeenCalledTimes(1);
    expect(onRemoveMany.mock.calls[0]?.[0]).toHaveLength(recipients.length);
    expect(onRemove).not.toHaveBeenCalled();
  });
});
