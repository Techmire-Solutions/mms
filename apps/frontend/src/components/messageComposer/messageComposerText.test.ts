import { describe, expect, it } from "vitest";
import type { StandardMessagingRecipient as MessagingRecipient } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import {
  getComposerNote,
  getComposerSaveLabel,
  getComposerSubtitle,
  getComposerTitle,
  getRecipientSendLabel,
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
    ).toBe('messaging.composerSummaryWhatsapp:{"eligible":"2","total":"2"}');

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

  it("returns the note for the mode that will actually dispatch", () => {
    expect(getComposerNote(dummyT, "email", false)).toBe("messaging.bulkEmailDesc");
    expect(getComposerNote(dummyT, "sms", false)).toBe("messaging.smsManualSendNote");
    expect(getComposerNote(dummyT, "whatsapp", false)).toBe("messaging.whatsappBulkManualNote");

    // Server gateway is the default mode: the copy must not promise a device app.
    expect(getComposerNote(dummyT, "email", true)).toBe("messaging.gatewayNoteEmail");
    expect(getComposerNote(dummyT, "sms", true)).toBe("messaging.gatewayNoteSms");
    expect(getComposerNote(dummyT, "whatsapp", true)).toBe("messaging.gatewayNoteWhatsapp");
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
        useServerGateway: true,
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
        useServerGateway: false,
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
        useServerGateway: false,
      }),
    ).toBe("messaging.openAllWhatsapp (2)");
  });

  it("labels the primary action for the server gateway", () => {
    expect(
      getComposerSaveLabel({
        t: dummyT,
        step: "compose",
        channel: "sms",
        localRecipients: [mockRecipients[0]],
        eligibleCount: 1,
        pendingAudit: false,
        opening: false,
        useServerGateway: true,
      }),
    ).toBe("messaging.gatewaySendSms");

    expect(
      getComposerSaveLabel({
        t: dummyT,
        step: "compose",
        channel: "whatsapp",
        localRecipients: mockRecipients,
        eligibleCount: 2,
        pendingAudit: false,
        opening: false,
        useServerGateway: true,
      }),
    ).toBe('messaging.gatewaySendAll:{"count":"2"}');

    expect(
      getComposerSaveLabel({
        t: dummyT,
        step: "compose",
        channel: "email",
        localRecipients: [mockRecipients[0]],
        eligibleCount: 1,
        pendingAudit: false,
        opening: false,
        useServerGateway: true,
      }),
    ).toBe("messaging.gatewaySendEmail");
  });

  it("labels per-recipient send actions for the active mode", () => {
    expect(
      getRecipientSendLabel({ t: dummyT, channel: "sms", isServerGateway: true, isValid: true }),
    ).toBe("messaging.gatewaySendSms");
    expect(
      getRecipientSendLabel({ t: dummyT, channel: "email", isServerGateway: true, isValid: true }),
    ).toBe("messaging.gatewaySendEmail");
    expect(
      getRecipientSendLabel({
        t: dummyT,
        channel: "whatsapp",
        isServerGateway: true,
        isValid: true,
      }),
    ).toBe("messaging.gatewaySendWhatsapp");

    expect(
      getRecipientSendLabel({ t: dummyT, channel: "sms", isServerGateway: false, isValid: true }),
    ).toBe("messaging.openSmsApp");
    expect(
      getRecipientSendLabel({ t: dummyT, channel: "sms", isServerGateway: true, isValid: false }),
    ).toBe("messaging.skippedStatus");
  });
});
