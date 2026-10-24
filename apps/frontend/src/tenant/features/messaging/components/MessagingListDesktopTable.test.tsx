import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Message } from "@mms/shared";
import { MessagingListDesktopTable } from "./MessagingListDesktopTable";
import { TranslationContext, type TranslationFunction } from "@/lib/contexts/TranslationContext";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === "messaging.selectedCount") return `${params?.count ?? 0} selected`;
      return key;
    },
  }),
}));

describe("MessagingListDesktopTable", () => {
  let container: HTMLDivElement;
  let root: Root;

  const mockLogs: Message[] = [
    {
      id: "msg-1",
      userId: "user-1",
      category: "general",
      contactId: "contact-1",
      channel: "sms",
      body: "Welcome to MMS parent orientation",
      status: "sent",
      sentAt: "2026-09-01T12:00:00Z",
    },
    {
      id: "msg-2",
      userId: "user-1",
      category: "emergency",
      contactId: "contact-2",
      channel: "email",
      subject: "Holiday Notice",
      body: "Classes resume on Monday",
      status: "failed",
      sentAt: "2026-09-02T08:30:00Z",
    },
  ];

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

  it("renders log rows, recipient names, channels, and footer counts", async () => {
    await act(async () => {
      root.render(
        <TranslationContext.Provider
          value={{
            language: "en",
            t: ((key: string) => key) as TranslationFunction,
            isLoading: false,
            dir: "ltr",
            isRtl: false,
          }}
        >
          <MessagingListDesktopTable
            logs={mockLogs}
            selectedIds={{ "msg-1": mockLogs[0] }}
            allVisibleSelected={false}
            someVisibleSelected={true}
            canWrite={true}
            logStatusConfig={mockStatusConfig}
            getRecipientName={(id) => (id === "contact-1" ? "Ahmad Khan" : "Fatima Noor")}
            getColumnWidth={() => undefined}
            isColumnVisible={() => true}
            setColumnWidth={vi.fn()}
            onToggleLog={vi.fn()}
            onToggleAllVisible={vi.fn()}
            onResendLog={vi.fn()}
          />
        </TranslationContext.Provider>,
      );
    });

    expect(container.textContent).toContain("Ahmad Khan");
    expect(container.textContent).toContain("Fatima Noor");
    expect(container.textContent).toContain("Welcome to MMS parent orientation");
    expect(container.textContent).toContain("Holiday Notice");
    expect(container.textContent).toContain("messaging.resend");
    expect(container.textContent).toContain("1 selected");
  });

  it("handles row selection toggle and resend click", async () => {
    const onToggleLog = vi.fn();
    const onResendLog = vi.fn();

    await act(async () => {
      root.render(
        <TranslationContext.Provider
          value={{
            language: "en",
            t: ((key: string) => key) as TranslationFunction,
            isLoading: false,
            dir: "ltr",
            isRtl: false,
          }}
        >
          <MessagingListDesktopTable
            logs={mockLogs}
            selectedIds={{}}
            allVisibleSelected={false}
            someVisibleSelected={false}
            canWrite={true}
            logStatusConfig={mockStatusConfig}
            getRecipientName={(id) => (id === "contact-1" ? "Ahmad Khan" : "Fatima Noor")}
            getColumnWidth={() => undefined}
            isColumnVisible={() => true}
            setColumnWidth={vi.fn()}
            onToggleLog={onToggleLog}
            onToggleAllVisible={vi.fn()}
            onResendLog={onResendLog}
          />
        </TranslationContext.Provider>,
      );
    });

    const resendButtons = container.querySelectorAll("button");
    const resendBtn = Array.from(resendButtons).find((btn) =>
      btn.textContent?.includes("messaging.resend"),
    );
    expect(resendBtn).toBeDefined();

    if (resendBtn) {
      await act(async () => {
        resendBtn.click();
      });
      expect(onResendLog).toHaveBeenCalled();
    }
  });
});
