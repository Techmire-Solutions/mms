import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TenantMessageComposerRecipientTable } from "./TenantMessageComposerRecipientTable";
import type { StandardMessagingRecipient } from "@mms/shared";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params?.name) return `${key}:${params.name}`;
      return key;
    },
  }),
}));

describe("TenantMessageComposerRecipientTable", () => {
  const sampleRecipients: StandardMessagingRecipient[] = [
    { id: "1", name: "Zaid Khan", phone: "+923001234567", email: "zaid@example.com" },
    { id: "2", name: "Bilal Ahmed", phone: "", email: "" },
  ];

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

  it("renders recipient rows and missing badges", () => {
    const html = renderToStaticMarkup(
      <TenantMessageComposerRecipientTable
        recipients={sampleRecipients}
        selectedIds={new Set(["1"])}
        onToggle={vi.fn()}
        onToggleAll={vi.fn()}
        allSelected={false}
        someSelected={true}
      />,
    );

    expect(html).toContain("Zaid Khan");
    expect(html).toContain("Bilal Ahmed");
    expect(html).toContain("+923001234567");
    expect(html).toContain("zaid@example.com");
    expect(html).toContain("messaging.missingPhone");
    expect(html).toContain("messaging.missingEmail");
  });

  it("toggles recipient selection when clicking the row checkbox", async () => {
    const onToggle = vi.fn();
    await act(async () => {
      root.render(
        <TenantMessageComposerRecipientTable
          recipients={sampleRecipients}
          selectedIds={new Set()}
          onToggle={onToggle}
          onToggleAll={vi.fn()}
          allSelected={false}
          someSelected={false}
        />,
      );
    });

    const checkboxes = container.querySelectorAll<HTMLButtonElement>('button[role="checkbox"]');
    // First checkbox is header select-all; second is first row
    expect(checkboxes.length).toBeGreaterThanOrEqual(2);
    await act(async () => {
      checkboxes[1]?.click();
    });

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith(sampleRecipients[0]);
  });

  it("toggles recipient selection when clicking the table row", async () => {
    const onToggle = vi.fn();
    await act(async () => {
      root.render(
        <TenantMessageComposerRecipientTable
          recipients={sampleRecipients}
          selectedIds={new Set()}
          onToggle={onToggle}
          onToggleAll={vi.fn()}
          allSelected={false}
          someSelected={false}
        />,
      );
    });

    const rows = container.querySelectorAll<HTMLTableRowElement>("tbody tr");
    expect(rows.length).toBe(2);
    await act(async () => {
      rows[0]?.click();
    });

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith(sampleRecipients[0]);
  });
});
