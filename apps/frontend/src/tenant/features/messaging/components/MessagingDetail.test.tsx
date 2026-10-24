import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MessagingDetail } from "./MessagingDetail";
import type { Message, StandardMessagingRecipient as MessagingRecipient } from "@mms/shared";
import type { StatusBadgeConfigItem } from "@/components/app/StatusBadge";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params?.id) return `Contact ${params.id}`;
      return key;
    },
  }),
}));

vi.mock("@/lib/notify", () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("MessagingDetail", () => {
  let container: HTMLDivElement;
  let root: Root;

  const mockLog: Message = {
    id: "msg-101",
    userId: "usr-1",
    channel: "sms",
    contactId: "cnt-1",
    body: "Assalamu alaikum, reminder for Quran class tomorrow at 9:00 AM.",
    status: "sent",
    sentAt: "2024-05-15T09:00:00.000Z",
    category: "general",
  };

  const mockRecipient: MessagingRecipient = {
    id: "rec-1",
    name: "Zayd Ali",
    phone: "+1234567890",
    email: "zayd@example.com",
  };

  const mockLogStatusConfig: Record<string, StatusBadgeConfigItem> = {
    sent: { label: "Sent", cls: "bg-success/10 text-success" },
    failed: { label: "Failed", cls: "bg-destructive/10 text-destructive" },
    skipped: { label: "Skipped", cls: "bg-warning/10 text-warning" },
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

  it("renders nothing when log is null", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <MessagingDetail
            log={null}
            recipient={mockRecipient}
            logStatusConfig={mockLogStatusConfig}
            canWrite={true}
            onClose={vi.fn()}
            onResend={vi.fn()}
          />
        </MemoryRouter>,
      );
    });

    expect(container.innerHTML).toBe("");
  });

  it("renders drawer with recipient details, channel, and message body", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <MessagingDetail
            log={mockLog}
            recipient={mockRecipient}
            logStatusConfig={mockLogStatusConfig}
            canWrite={true}
            onClose={vi.fn()}
            onResend={vi.fn()}
          />
        </MemoryRouter>,
      );
    });

    expect(document.body.textContent).toContain("Zayd Ali");
    expect(document.body.textContent).toContain(
      "Assalamu alaikum, reminder for Quran class tomorrow",
    );
    expect(document.body.textContent).toContain("sms");
  });

  it("displays diagnostics warning for failed messages", async () => {
    const failedLog: Message = {
      ...mockLog,
      status: "failed",
    };

    await act(async () => {
      root.render(
        <MemoryRouter>
          <MessagingDetail
            log={failedLog}
            recipient={mockRecipient}
            logStatusConfig={mockLogStatusConfig}
            canWrite={true}
            onClose={vi.fn()}
            onResend={vi.fn()}
          />
        </MemoryRouter>,
      );
    });

    expect(document.body.textContent).toContain("messaging.status.failed");
    expect(document.body.textContent).toContain("messaging.loadFailedHint");
  });

  it("triggers onResend and onClose when Resend button is clicked", async () => {
    const onResend = vi.fn();
    const onClose = vi.fn();

    await act(async () => {
      root.render(
        <MemoryRouter>
          <MessagingDetail
            log={mockLog}
            recipient={mockRecipient}
            logStatusConfig={mockLogStatusConfig}
            canWrite={true}
            onClose={onClose}
            onResend={onResend}
          />
        </MemoryRouter>,
      );
    });

    const resendBtn = Array.from(document.body.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("messaging.resend"),
    );
    expect(resendBtn).toBeDefined();

    await act(async () => {
      resendBtn?.click();
    });

    expect(onClose).toHaveBeenCalled();
    expect(onResend).toHaveBeenCalledWith(mockLog);
  });
});
