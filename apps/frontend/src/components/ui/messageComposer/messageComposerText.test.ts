import { describe, expect, it } from "vitest";
import type { StandardMessagingRecipient as MessagingRecipient } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import {
  getComposerNote,
  getComposerSaveLabel,
  getComposerSubtitle,
  getComposerTitle,
} from "./messageComposerText";

describe("messageComposerText", () => {
  const dummyT = ((key: string, params?: Record<string, string | number>) => {
    if (params) {
      return `${key}:${JSON.stringify(params)}`;
    }
    return key;
  }) as TranslationFunction;

  const mockRecipients: MessagingRecipient[] = [
    { id: "1", name: "Zainab Ali", phone: "+1234567890", email: "zainab@example.com" },
    { id: "2", name: "Hassan Raza", phone: "+1234567891", email: "hassan@example.com" },
  ];

  it("generates correct title for pick and compose steps", () => {
    expect(
      getComposerTitle({
        t: dummyT,
        step: "pick",
        channel: "sms",
        localRecipients: mockRecipients,
      }),
    ).toBe("messaging.selectRecipients");

    expect(
      getComposerTitle({
        t: dummyT,
        step: "compose",
        channel: "sms",
        localRecipients: [mockRecipients[0]],
      }),
    ).toBe("messaging.sms – Zainab Ali");

    expect(
      getComposerTitle({
        t: dummyT,
        step: "compose",
        channel: "whatsapp",
        localRecipients: mockRecipients,
      }),
    ).toBe("messaging.bulkWhatsappTitle");
  });

  it("generates subtitle for bulk recipients", () => {
    expect(
      getComposerSubtitle({
        t: dummyT,
        step: "pick",
        channel: "sms",
        localRecipients: mockRecipients,
        eligibleCount: 2,
      }),
    ).toBe("messaging.selectRecipientsDesc");

    expect(
      getComposerSubtitle({
        t: dummyT,
        step: "compose",
        channel: "whatsapp",
        localRecipients: mockRecipients,
        eligibleCount: 2,
      }),
    ).toBe("2 messaging.of 2 messaging.contactsHaveWhatsapp");

    expect(
      getComposerSubtitle({
        t: dummyT,
        step: "compose",
        channel: "whatsapp",
        localRecipients: [mockRecipients[0]],
        eligibleCount: 1,
      }),
    ).toBeUndefined();
  });

  it("returns note based on channel", () => {
    expect(getComposerNote(dummyT, "email")).toBe("messaging.bulkEmailDesc");
    expect(getComposerNote(dummyT, "sms")).toBe("messaging.smsManualSendNote");
    expect(getComposerNote(dummyT, "whatsapp")).toBe("messaging.whatsappBulkManualNote");
  });

  it("generates saveLabel appropriately", () => {
    expect(
      getComposerSaveLabel({
        t: dummyT,
        step: "pick",
        channel: "sms",
        localRecipients: mockRecipients,
        eligibleCount: 2,
        pendingAudit: false,
        opening: false,
      }),
    ).toBe("common.next");

    expect(
      getComposerSaveLabel({
        t: dummyT,
        step: "compose",
        channel: "sms",
        localRecipients: [mockRecipients[0]],
        eligibleCount: 1,
        pendingAudit: false,
        opening: false,
      }),
    ).toBe("messaging.openSmsApp");

    expect(
      getComposerSaveLabel({
        t: dummyT,
        step: "compose",
        channel: "whatsapp",
        localRecipients: mockRecipients,
        eligibleCount: 2,
        pendingAudit: false,
        opening: false,
      }),
    ).toBe("messaging.openAllWhatsapp (2)");
  });
});
