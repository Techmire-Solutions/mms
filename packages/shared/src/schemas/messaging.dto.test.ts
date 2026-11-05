import { describe, expect, it } from "vitest";
import { messageLogCreateSchema, messageStatusSchema } from "./messaging.dto.js";

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
