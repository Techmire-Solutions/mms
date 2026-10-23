import { describe, expect, it, vi, beforeEach } from "vitest";
import { notify } from "@/lib/notify";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import {
  dispatchViaServerGateway,
  notifyServerDispatchOutcome,
} from "./messageComposerServerGateway";
import type { ValidatedMessagingRecipient } from "./messageComposerDispatchService";

vi.mock("@/lib/notify", () => ({
  notify: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("messageComposerServerGateway", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockT = ((key: string, params?: Record<string, unknown>) => {
    if (!params) return key;
    return `${key}:${JSON.stringify(params)}`;
  }) as unknown as TranslationFunction;

  describe("notifyServerDispatchOutcome", () => {
    it("calls notify.error when all messages failed", () => {
      notifyServerDispatchOutcome({
        channel: "sms",
        sentCount: 0,
        failedCount: 5,
        t: mockT,
      });
      expect(notify.error).toHaveBeenCalledWith(
        expect.stringContaining("messaging.serverDispatchFailed"),
      );
      expect(notify.success).not.toHaveBeenCalled();
      expect(notify.warning).not.toHaveBeenCalled();
    });

    it("calls notify.warning on partial failure", () => {
      notifyServerDispatchOutcome({
        channel: "sms",
        sentCount: 3,
        failedCount: 2,
        t: mockT,
      });
      expect(notify.warning).toHaveBeenCalledWith(
        expect.stringContaining("messaging.serverPartialSuccess"),
      );
      expect(notify.success).not.toHaveBeenCalled();
      expect(notify.error).not.toHaveBeenCalled();
    });

    it("calls notify.success when all messages succeed for each channel", () => {
      notifyServerDispatchOutcome({
        channel: "sms",
        sentCount: 4,
        failedCount: 0,
        t: mockT,
      });
      expect(notify.success).toHaveBeenCalledWith(
        expect.stringContaining("messaging.serverSmsSuccess"),
      );

      notifyServerDispatchOutcome({
        channel: "email",
        sentCount: 2,
        failedCount: 0,
        t: mockT,
      });
      expect(notify.success).toHaveBeenCalledWith(
        expect.stringContaining("messaging.serverEmailSuccess"),
      );

      notifyServerDispatchOutcome({
        channel: "whatsapp",
        sentCount: 6,
        failedCount: 0,
        t: mockT,
      });
      expect(notify.success).toHaveBeenCalledWith(
        expect.stringContaining("messaging.serverWhatsAppSuccess"),
      );
    });
  });

  describe("dispatchViaServerGateway", () => {
    const mockRecipients: ValidatedMessagingRecipient[] = [
      { id: "1", name: "Alice", phone: "+1234567890", email: "alice@example.com", isValid: true },
    ];

    it("handles queued response", async () => {
      const dispatchServerSms = {
        mutateAsync: vi.fn().mockResolvedValue({ queued: true, sentCount: 0 }),
      };
      const onClose = vi.fn();

      await dispatchViaServerGateway({
        channel: "sms",
        eligibleRecipients: mockRecipients,
        message: "Hello Alice",
        subject: "",
        category: "general",
        personalizeOptions: { madrasaName: "Test" },
        dispatchServerSms,
        dispatchServerEmail: { mutateAsync: vi.fn() },
        dispatchServerWhatsApp: { mutateAsync: vi.fn() },
        onClose,
        t: mockT,
      });

      expect(dispatchServerSms.mutateAsync).toHaveBeenCalled();
      expect(notify.info).toHaveBeenCalledWith(
        expect.stringContaining("messaging.campaignQueuedNotice"),
      );
      expect(onClose).toHaveBeenCalled();
    });

    it("handles synchronous successful dispatch and calls onSent", async () => {
      const dispatchServerWhatsApp = {
        mutateAsync: vi.fn().mockResolvedValue({ sentCount: 1, failedCount: 0 }),
      };
      const onSent = vi.fn();
      const onClose = vi.fn();

      await dispatchViaServerGateway({
        channel: "whatsapp",
        eligibleRecipients: mockRecipients,
        message: "Hello Alice",
        subject: "",
        category: "general",
        personalizeOptions: { madrasaName: "Test" },
        dispatchServerSms: { mutateAsync: vi.fn() },
        dispatchServerEmail: { mutateAsync: vi.fn() },
        dispatchServerWhatsApp,
        onSent,
        onClose,
        t: mockT,
      });

      expect(dispatchServerWhatsApp.mutateAsync).toHaveBeenCalled();
      expect(onSent).toHaveBeenCalled();
      expect(notify.success).toHaveBeenCalledWith(
        expect.stringContaining("messaging.serverWhatsAppSuccess"),
      );
      expect(onClose).toHaveBeenCalled();
    });
  });
});
