import { describe, expect, it } from "vitest";
import { WHATSAPP_STATUS_VALUES, type WhatsAppStatus } from "./contactEntityTypes.js";
import { phoneNumberSchema } from "./contactNestedSchemas.js";

const ALL_STATUSES: WhatsAppStatus[] = ["PENDING", "REGISTERED", "NOT_REGISTERED", "FAILED"];

describe("WHATSAPP_STATUS_VALUES", () => {
  it("mirrors every WhatsAppStatus union member", () => {
    expect([...WHATSAPP_STATUS_VALUES]).toEqual(ALL_STATUSES);
    expect(new Set(WHATSAPP_STATUS_VALUES)).toEqual(new Set(ALL_STATUSES));
  });

  it("drives the nested phone-number enum schema", () => {
    for (const status of WHATSAPP_STATUS_VALUES) {
      expect(
        phoneNumberSchema.safeParse({ number: "+920000000000", whatsappStatus: status }).success,
      ).toBe(true);
    }
    expect(
      phoneNumberSchema.safeParse({ number: "+920000000000", whatsappStatus: "INVALID" }).success,
    ).toBe(false);
  });
});
