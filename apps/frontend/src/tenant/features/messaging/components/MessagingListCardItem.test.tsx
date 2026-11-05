import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MessagingListCardItem, getMessagingChannelAccentBarClass } from "./MessagingListCardItem";
import type { Message } from "@mms/shared";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("MessagingListCardItem", () => {
  let container: HTMLDivElement;
  let root: Root;

  const mockLog: Message = {
    id: "msg-101",
    userId: "user-1",
    category: "general",
    contactId: "contact-1",
    channel: "sms",
    body: "Meeting reminder for tomorrow",
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

  it("computes channel accent bar class according to selection and channel", () => {
    expect(getMessagingChannelAccentBarClass(true, "sms")).toContain("bg-primary");
    expect(getMessagingChannelAccentBarClass(false, "whatsapp")).toContain("bg-success");
    expect(getMessagingChannelAccentBarClass(false, "sms")).toContain("bg-info");
    expect(getMessagingChannelAccentBarClass(false, "email")).toContain("bg-warning");
    expect(getMessagingChannelAccentBarClass(false, "other")).toContain("bg-muted-foreground");
  });

  it("renders card item with recipient and body content", async () => {
    await act(async () => {
      root.render(
        <MessagingListCardItem
          log={mockLog}
          isSelected={false}
          name="Fatima Zahra"
          isCopied={false}
          canWrite={true}
          reducedMotion={true}
          logStatusConfig={mockStatusConfig}
          isColumnVisible={() => true}
          onToggleLog={vi.fn()}
          onResendLog={vi.fn()}
          onCopyBody={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain("Fatima Zahra");
    expect(container.textContent).toContain("Meeting reminder for tomorrow");
    expect(container.textContent).toContain("messaging.resend");
    // Mixed-script message bodies must resolve their own direction.
    const body = Array.from(container.querySelectorAll('[dir="auto"]')).find((node) =>
      node.textContent?.includes("Meeting reminder for tomorrow"),
    );
    expect(body).not.toBeUndefined();
  });

  it("renders the gateway failure reason on a failed log", async () => {
    const failedLog: Message = {
      ...mockLog,
      status: "failed",
      errorMessage: "Insufficient gateway balance",
    };

    await act(async () => {
      root.render(
        <MessagingListCardItem
          log={failedLog}
          isSelected={false}
          name="Fatima Zahra"
          isCopied={false}
          canWrite={false}
          reducedMotion={true}
          logStatusConfig={mockStatusConfig}
          isColumnVisible={() => true}
          onToggleLog={vi.fn()}
          onResendLog={vi.fn()}
          onCopyBody={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain("Insufficient gateway balance");
    expect(container.textContent).not.toContain("messaging.loadFailedHint");
  });

  it("triggers onResendLog on button click", async () => {
    const onResendLog = vi.fn();

    await act(async () => {
      root.render(
        <MessagingListCardItem
          log={mockLog}
          isSelected={false}
          name="Fatima Zahra"
          isCopied={false}
          canWrite={true}
          reducedMotion={true}
          logStatusConfig={mockStatusConfig}
          isColumnVisible={() => true}
          onToggleLog={vi.fn()}
          onResendLog={onResendLog}
          onCopyBody={vi.fn()}
        />,
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

  it("renders a legacy log with a malformed sentAt instead of crashing", async () => {
    await act(async () => {
      root.render(
        <MessagingListCardItem
          log={{ ...mockLog, sentAt: "not-a-date" }}
          isSelected={false}
          name="Fatima Zahra"
          canWrite={false}
          reducedMotion={true}
          logStatusConfig={mockStatusConfig}
          isColumnVisible={() => true}
          onToggleLog={vi.fn()}
          onResendLog={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain("Fatima Zahra");
    expect(container.querySelector("time")?.getAttribute("dateTime")).not.toBe("Invalid Date");
  });
});
