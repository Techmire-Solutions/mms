import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MessagingListDesktopRow } from "./MessagingListDesktopRow";
import type { Message } from "@mms/shared";
import { Table, TableBody } from "@/components/ui/table";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("MessagingListDesktopRow", () => {
  let container: HTMLDivElement;
  let root: Root;

  const mockLog: Message = {
    id: "msg-1",
    userId: "user-1",
    category: "general",
    contactId: "contact-1",
    channel: "sms",
    body: "Test message body content",
    status: "sent",
    sentAt: "2026-09-01T12:00:00Z",
  };

  const mockStatusConfig = {
    sent: { label: "Sent", variant: "success" as const, cls: "text-emerald-700" },
    failed: { label: "Failed", variant: "destructive" as const, cls: "text-rose-700" },
  };

  beforeEach(() => {
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

  it("renders recipient, channel, and message body", async () => {
    await act(async () => {
      root.render(
        <Table>
          <TableBody>
            <MessagingListDesktopRow
              log={mockLog}
              isSelected={false}
              name="Ahmad Khan"
              isCopied={false}
              canWrite={true}
              logStatusConfig={mockStatusConfig}
              showRecipient={true}
              showChannel={true}
              showBody={true}
              showDateSent={true}
              onToggleLog={vi.fn()}
              onResendLog={vi.fn()}
              onCopyBody={vi.fn()}
            />
          </TableBody>
        </Table>,
      );
    });

    expect(container.textContent).toContain("Ahmad Khan");
    expect(container.textContent).toContain("Test message body content");
    expect(container.textContent).toContain("messaging.resend");
  });

  it("triggers onResendLog when resend button is clicked", async () => {
    const onResendLog = vi.fn();

    await act(async () => {
      root.render(
        <Table>
          <TableBody>
            <MessagingListDesktopRow
              log={mockLog}
              isSelected={false}
              name="Ahmad Khan"
              isCopied={false}
              canWrite={true}
              logStatusConfig={mockStatusConfig}
              showRecipient={true}
              showChannel={true}
              showBody={true}
              showDateSent={true}
              onToggleLog={vi.fn()}
              onResendLog={onResendLog}
              onCopyBody={vi.fn()}
            />
          </TableBody>
        </Table>,
      );
    });

    const resendBtn = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("messaging.resend"),
    );
    expect(resendBtn).toBeDefined();

    await act(async () => {
      resendBtn?.click();
    });

    expect(onResendLog).toHaveBeenCalledWith(mockLog);
  });

  it("triggers onCopyBody when copy icon button is clicked", async () => {
    const onCopyBody = vi.fn();

    await act(async () => {
      root.render(
        <Table>
          <TableBody>
            <MessagingListDesktopRow
              log={mockLog}
              isSelected={false}
              name="Ahmad Khan"
              isCopied={false}
              canWrite={true}
              logStatusConfig={mockStatusConfig}
              showRecipient={true}
              showChannel={true}
              showBody={true}
              showDateSent={true}
              onToggleLog={vi.fn()}
              onResendLog={vi.fn()}
              onCopyBody={onCopyBody}
            />
          </TableBody>
        </Table>,
      );
    });

    const copyBtn = container.querySelector("button[title='contacts.table.copy']");
    expect(copyBtn).toBeDefined();

    await act(async () => {
      (copyBtn as HTMLButtonElement)?.click();
    });

    expect(onCopyBody).toHaveBeenCalled();
  });

  it("renders shimmer placeholder when name is unresolved fallback", async () => {
    await act(async () => {
      root.render(
        <Table>
          <TableBody>
            <MessagingListDesktopRow
              log={mockLog}
              isSelected={false}
              name="Contact #contact-1"
              isCopied={false}
              canWrite={true}
              logStatusConfig={mockStatusConfig}
              showRecipient={true}
              showChannel={true}
              showBody={true}
              showDateSent={true}
              onToggleLog={vi.fn()}
              onResendLog={vi.fn()}
              onCopyBody={vi.fn()}
            />
          </TableBody>
        </Table>,
      );
    });

    const shimmer = container.querySelector(".animate-pulse");
    expect(shimmer).not.toBeNull();
  });
});
