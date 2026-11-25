import { describe, expect, it, vi } from "vitest";
import {
  buildDetailEmailMessagingActions,
  buildDetailPhoneMessagingActions,
} from "./contactDetailMessagingActions.js";

describe("buildDetailPhoneMessagingActions", () => {
  it("always includes the call action with a tel: href", () => {
    const actions = buildDetailPhoneMessagingActions({
      phone: "+92 300 1234567",
      callTitle: "Call",
    });
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ key: "call", title: "Call" });
    expect(actions[0]?.href).toMatch(/^tel:\+92/);
  });

  it("adds whatsapp only when both title and handler exist", () => {
    const onWhatsApp = vi.fn();
    const actions = buildDetailPhoneMessagingActions({
      phone: "+92 300 1234567",
      callTitle: "Call",
      whatsappTitle: "WhatsApp",
      onWhatsApp,
    });
    expect(actions.map((a) => a.key)).toEqual(["call", "whatsapp"]);
    actions.find((a) => a.key === "whatsapp")?.onClick?.();
    expect(onWhatsApp).toHaveBeenCalledOnce();
  });

  it("omits whatsapp when only the title is present without a handler", () => {
    const actions = buildDetailPhoneMessagingActions({
      phone: "+92 300 1234567",
      callTitle: "Call",
      whatsappTitle: "WhatsApp",
    });
    expect(actions.map((a) => a.key)).toEqual(["call"]);
  });

  it("adds sms only when both title and handler exist", () => {
    const onSms = vi.fn();
    const actions = buildDetailPhoneMessagingActions({
      phone: "+92 300 1234567",
      callTitle: "Call",
      smsTitle: "SMS",
      onSms,
    });
    expect(actions.map((a) => a.key)).toEqual(["call", "sms"]);
    actions.find((a) => a.key === "sms")?.onClick?.();
    expect(onSms).toHaveBeenCalledOnce();
  });

  it("builds call + whatsapp + sms together and applies tone classes", () => {
    const actions = buildDetailPhoneMessagingActions({
      phone: "+92 300 1234567",
      callTitle: "Call",
      whatsappTitle: "WhatsApp",
      smsTitle: "SMS",
      onWhatsApp: vi.fn(),
      onSms: vi.fn(),
    });
    expect(actions.map((a) => a.key)).toEqual(["call", "whatsapp", "sms"]);
    expect(actions[0]?.className).toContain("border-info");
    expect(actions[1]?.className).toContain("border-success");
    expect(actions[2]?.className).toContain("border-primary");
  });
});

describe("buildDetailEmailMessagingActions", () => {
  it("builds a single email action wired to the handler", () => {
    const onEmail = vi.fn();
    const actions = buildDetailEmailMessagingActions({ emailTitle: "Email", onEmail });
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ key: "email", title: "Email" });
    actions[0]?.onClick?.();
    expect(onEmail).toHaveBeenCalledOnce();
  });
});
