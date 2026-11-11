import { describe, expect, it } from "vitest";
import {
  messageInsertSchema,
  messageLogCreateSchema,
  messageStatusSchema,
  messagingLogsQuerySchema,
} from "./messaging.dto.js";
import {
  messagingSmsDispatchSchema,
  messagingEmailDispatchSchema,
  messagingWhatsAppDispatchSchema,
} from "../messaging/messagingDispatchSchemas.js";

const baseLog = {
  contactId: "c-1",
  channel: "sms" as const,
  body: "Hello",
};

describe("messaging status taxonomy", () => {
  it("exposes the in-flight `sending` state on the read enum", () => {
    expect(messageStatusSchema.safeParse("sending").success).toBe(true);
    expect(messageStatusSchema.options).toContain("sending");
  });

  it("never lets a client write `sending` through the create schema", () => {
    expect(messageLogCreateSchema.safeParse({ ...baseLog, status: "sending" }).success).toBe(false);
    expect(messageLogCreateSchema.safeParse({ ...baseLog, status: "sent" }).success).toBe(true);
  });
});

describe("messaging input invariant validations", () => {
  it("rejects whitespace-only bodies in messageLogCreateSchema", () => {
    expect(messageLogCreateSchema.safeParse({ ...baseLog, body: "   \n\t  " }).success).toBe(false);
    expect(messageLogCreateSchema.safeParse({ ...baseLog, body: "Valid content" }).success).toBe(
      true,
    );
  });

  it("rejects whitespace-only bodies in messageInsertSchema", () => {
    expect(messageInsertSchema.safeParse({ ...baseLog, body: "    " }).success).toBe(false);
    expect(messageInsertSchema.safeParse({ ...baseLog, body: "Valid content" }).success).toBe(true);
  });

  it("rejects whitespace-only messages in dispatch schemas", () => {
    const sms = {
      recipients: [{ id: "c-1", phone: "+1234567890" }],
      message: "   ",
    };
    expect(messagingSmsDispatchSchema.safeParse(sms).success).toBe(false);
    expect(messagingSmsDispatchSchema.safeParse({ ...sms, message: "Valid SMS" }).success).toBe(
      true,
    );

    const email = {
      recipients: [{ id: "c-1", email: "user@example.com" }],
      subject: "Test",
      message: "\t\n  ",
    };
    expect(messagingEmailDispatchSchema.safeParse(email).success).toBe(false);
    expect(
      messagingEmailDispatchSchema.safeParse({ ...email, message: "Valid Email" }).success,
    ).toBe(true);

    const whatsapp = {
      recipients: [{ id: "c-1", phone: "+1234567890" }],
      message: "   ",
    };
    expect(messagingWhatsAppDispatchSchema.safeParse(whatsapp).success).toBe(false);
    expect(
      messagingWhatsAppDispatchSchema.safeParse({ ...whatsapp, message: "Valid WhatsApp" }).success,
    ).toBe(true);
  });

  it("permits userId query filtering in messagingLogsQuerySchema", () => {
    const res = messagingLogsQuerySchema.safeParse({ userId: "user-123", page: 1 });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.userId).toBe("user-123");
    }
  });
});
