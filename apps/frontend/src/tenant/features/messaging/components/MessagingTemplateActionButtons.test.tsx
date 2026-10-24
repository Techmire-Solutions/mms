import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MessagingTemplateActionButtons } from "./MessagingTemplateActionButtons";
import type { MessageTemplate } from "@mms/shared";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("MessagingTemplateActionButtons", () => {
  let container: HTMLDivElement;
  let root: Root;

  const systemTemplate: MessageTemplate = {
    id: "sys_welcome",
    label: "Welcome",
    category: "general",
    channel: "all",
    body: "Welcome to MMS!",
  };

  const customTemplate: MessageTemplate = {
    id: "custom_reminder",
    label: "Fee Reminder",
    category: "financial",
    channel: "sms",
    body: "Please submit fees soon.",
  };

  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      configurable: true,
      writable: true,
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  it("renders copy button and dispatches onCopy with body", async () => {
    const onCopy = vi.fn();

    await act(async () => {
      root.render(
        <MessagingTemplateActionButtons
          template={systemTemplate}
          canWrite={false}
          onCopy={onCopy}
          onDuplicate={vi.fn()}
          onEdit={vi.fn()}
          onDeleteRequest={vi.fn()}
        />,
      );
    });

    const copyBtn = container.querySelector("button[aria-label='messaging.copyTemplate']");
    expect(copyBtn).toBeDefined();

    await act(async () => {
      (copyBtn as HTMLButtonElement)?.click();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(onCopy).toHaveBeenCalledWith("Welcome to MMS!");
    expect(container.textContent).toContain("messaging.tagSystem");
  });

  it("renders duplicate button when canWrite is true", async () => {
    const onDuplicate = vi.fn();

    await act(async () => {
      root.render(
        <MessagingTemplateActionButtons
          template={systemTemplate}
          canWrite={true}
          onCopy={vi.fn()}
          onDuplicate={onDuplicate}
          onEdit={vi.fn()}
          onDeleteRequest={vi.fn()}
        />,
      );
    });

    const dupBtn = container.querySelector("button[aria-label='messaging.duplicateTemplate']");
    expect(dupBtn).toBeDefined();

    await act(async () => {
      (dupBtn as HTMLButtonElement)?.click();
    });

    expect(onDuplicate).toHaveBeenCalledWith(systemTemplate);
  });

  it("renders edit and delete buttons for custom templates when canWrite is true", async () => {
    const onEdit = vi.fn();
    const onDeleteRequest = vi.fn();

    await act(async () => {
      root.render(
        <MessagingTemplateActionButtons
          template={customTemplate}
          canWrite={true}
          onCopy={vi.fn()}
          onDuplicate={vi.fn()}
          onEdit={onEdit}
          onDeleteRequest={onDeleteRequest}
        />,
      );
    });

    const editBtn = container.querySelector("button[aria-label='common.edit']");
    const deleteBtn = container.querySelector("button[aria-label='common.delete']");

    expect(editBtn).toBeDefined();
    expect(deleteBtn).toBeDefined();

    await act(async () => {
      (editBtn as HTMLButtonElement)?.click();
    });
    expect(onEdit).toHaveBeenCalledWith(customTemplate);

    await act(async () => {
      (deleteBtn as HTMLButtonElement)?.click();
    });
    expect(onDeleteRequest).toHaveBeenCalledWith("custom_reminder");
  });
});
