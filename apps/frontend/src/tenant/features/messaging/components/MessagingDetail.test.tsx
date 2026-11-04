import { act } from "react";
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

const { permissions } = vi.hoisted(() => ({
  permissions: { contactsRead: true },
}));

vi.mock("@/tenant/hooks/usePermissions", () => ({
  useModulePermissions: () => ({ canRead: permissions.contactsRead }),
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
    permissions.contactsRead = true;
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

    // The body must resolve its own direction for mixed-script content.
    const body = Array.from(document.body.querySelectorAll('[dir="auto"]')).find((node) =>
      node.textContent?.includes("Assalamu alaikum, reminder for Quran class tomorrow"),
    );
    expect(body).not.toBeUndefined();

    // Interactive targets meet the 44×44 floor (the log-id copy used to be 24px).
    const copyButtons = Array.from(document.body.querySelectorAll("button")).filter(
      (button) => button.getAttribute("title") === "common.copy",
    );
    expect(copyButtons.length).toBeGreaterThan(0);
    for (const button of copyButtons) {
      expect(button.className).toContain("min-h-11");
      expect(button.className).not.toContain("h-6");
    }
  });

  it("displays the gateway failure reason for failed messages", async () => {
    const failedLog: Message = {
      ...mockLog,
      status: "failed",
      errorMessage: "Gateway rejected: invalid destination number",
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
    // The gateway's own reason is the only useful diagnostic — never the
    // generic list-load hint.
    expect(document.body.textContent).toContain("Gateway rejected: invalid destination number");
    expect(document.body.textContent).not.toContain("messaging.loadFailedHint");
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

  it("keeps a single Resend primary action for a failed log", async () => {
    const onResend = vi.fn();
    const onClose = vi.fn();
    const failedLog = { ...mockLog, status: "failed" as const };

    await act(async () => {
      root.render(
        <MemoryRouter>
          <MessagingDetail
            log={failedLog}
            recipient={mockRecipient}
            logStatusConfig={mockLogStatusConfig}
            canWrite={true}
            onClose={onClose}
            onResend={onResend}
          />
        </MemoryRouter>,
      );
    });

    const resendButtons = Array.from(document.body.querySelectorAll("button")).filter((b) =>
      b.textContent?.includes("messaging.resend"),
    );
    // The failed panel used to repeat the footer's primary action.
    expect(resendButtons).toHaveLength(1);

    await act(async () => {
      resendButtons[0]?.click();
    });

    expect(onClose).toHaveBeenCalled();
    expect(onResend).toHaveBeenCalledWith(failedLog);
  });

  it("resends on Cmd/Ctrl+Enter from inside the drawer", async () => {
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

    // Focus lives inside the drawer's own role="dialog" — the shortcut used to
    // be swallowed there, making the advertised (⌘+Enter) dead.
    const dialog = document.body.querySelector("[role='dialog']") as HTMLElement;
    expect(dialog).not.toBeNull();
    await act(async () => {
      dialog.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", metaKey: true, bubbles: true }),
      );
    });

    expect(onResend).toHaveBeenCalledWith(mockLog);
  });

  it("does not resend through an open confirmation dialog", async () => {
    const onResend = vi.fn();

    await act(async () => {
      root.render(
        <MemoryRouter>
          <MessagingDetail
            log={mockLog}
            recipient={mockRecipient}
            logStatusConfig={mockLogStatusConfig}
            canWrite={true}
            onClose={vi.fn()}
            onResend={onResend}
          />
        </MemoryRouter>,
      );
    });

    const confirm = document.createElement("div");
    confirm.setAttribute("role", "alertdialog");
    document.body.appendChild(confirm);

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", metaKey: true, bubbles: true }),
      );
    });

    expect(onResend).not.toHaveBeenCalled();
    confirm.remove();
  });

  it("hides the contact profile link without contacts.read", async () => {
    permissions.contactsRead = false;

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

    // A messaging-only role cannot open /contacts; the link would dead-end.
    expect(document.body.textContent).not.toContain("contacts.table.viewProfile");
  });

  it("shows the contact profile link when contacts.read is granted", async () => {
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

    expect(document.body.textContent).toContain("contacts.table.viewProfile");
  });
});
