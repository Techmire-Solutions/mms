import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  sendTenantSms: vi.fn(),
  sendTenantWhatsApp: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("../services/sms/smsService.js", () => ({ sendTenantSms: mocks.sendTenantSms }));
vi.mock("../services/whatsapp/whatsappService.js", () => ({
  sendTenantWhatsApp: mocks.sendTenantWhatsApp,
}));
vi.mock("../lib/logger.js", () => ({ logger: { warn: mocks.warn } }));

const { sendRegistrationAcknowledgement } =
  await import("../enrollments/use-cases/registrationAcknowledgement.js");

const base = { phone: "+923001234567", reference: "APP-7K2QX9MD", workspaceName: "Al Noor" };

describe("sendRegistrationAcknowledgement", () => {
  beforeEach(() => {
    mocks.sendTenantSms.mockReset();
    mocks.warn.mockReset();
    mocks.sendTenantSms.mockResolvedValue({ sent: true });
    mocks.sendTenantWhatsApp.mockReset();
    mocks.sendTenantWhatsApp.mockResolvedValue({ sent: true });
  });

  it("texts the reference for a submitted application", async () => {
    await sendRegistrationAcknowledgement({ ...base, status: "submitted" });
    expect(mocks.sendTenantSms).toHaveBeenCalledTimes(1);
    const [{ to, body }] = mocks.sendTenantSms.mock.calls[0] as [{ to: string; body: string }];
    expect(to).toBe(base.phone);
    expect(body).toContain("APP-7K2QX9MD");
    expect(body).toContain("Al Noor");
    expect(body).toContain("awaiting review");
  });

  it("tells a waitlisted applicant they are on the waiting list", async () => {
    await sendRegistrationAcknowledgement({ ...base, status: "waitlisted" });
    const [{ body }] = mocks.sendTenantSms.mock.calls[0] as [{ body: string }];
    expect(body).toContain("waiting list");
  });

  it("confirms an auto-approved application", async () => {
    await sendRegistrationAcknowledgement({ ...base, status: "approved" });
    const [{ body }] = mocks.sendTenantSms.mock.calls[0] as [{ body: string }];
    expect(body).toContain("approved");
  });

  it("sends nothing for a staff-side status", async () => {
    await sendRegistrationAcknowledgement({ ...base, status: "rejected" });
    await sendRegistrationAcknowledgement({ ...base, status: "under_review" });
    await sendRegistrationAcknowledgement({ ...base, status: "withdrawn" });
    expect(mocks.sendTenantSms).not.toHaveBeenCalled();
    expect(mocks.sendTenantWhatsApp).not.toHaveBeenCalled();
  });

  it("sends nothing when there is no phone number", async () => {
    await sendRegistrationAcknowledgement({ ...base, phone: "   ", status: "submitted" });
    expect(mocks.sendTenantSms).not.toHaveBeenCalled();
  });

  it("stays quiet when the workspace has SMS notifications switched off", async () => {
    mocks.sendTenantSms.mockResolvedValue({ sent: false, reason: "notifications_disabled" });
    await sendRegistrationAcknowledgement({ ...base, status: "submitted" });
    expect(mocks.warn).not.toHaveBeenCalled();
  });

  it("logs a transport failure without throwing", async () => {
    mocks.sendTenantSms.mockResolvedValue({ sent: false, reason: "transport_error" });
    await expect(
      sendRegistrationAcknowledgement({ ...base, status: "submitted" }),
    ).resolves.toBeUndefined();
    expect(mocks.warn).toHaveBeenCalledTimes(1);
  });

  it("swallows a thrown provider error so the submission still succeeds", async () => {
    mocks.sendTenantSms.mockRejectedValue(new Error("provider exploded"));
    await expect(
      sendRegistrationAcknowledgement({ ...base, status: "submitted" }),
    ).resolves.toBeUndefined();
    expect(mocks.warn).toHaveBeenCalledTimes(1);
  });

  it("sends the same message by WhatsApp", async () => {
    await sendRegistrationAcknowledgement({ ...base, status: "submitted" });
    expect(mocks.sendTenantWhatsApp).toHaveBeenCalledTimes(1);
    expect(mocks.sendTenantWhatsApp.mock.calls[0]).toEqual(mocks.sendTenantSms.mock.calls[0]);
  });

  it("stays quiet when the workspace has WhatsApp notifications switched off", async () => {
    mocks.sendTenantWhatsApp.mockResolvedValue({ sent: false, reason: "notifications_disabled" });
    await sendRegistrationAcknowledgement({ ...base, status: "submitted" });
    expect(mocks.sendTenantSms).toHaveBeenCalledTimes(1);
    expect(mocks.warn).not.toHaveBeenCalled();
  });

  it("still sends WhatsApp when SMS throws, and logs the SMS failure", async () => {
    mocks.sendTenantSms.mockRejectedValue(new Error("provider down"));
    await expect(
      sendRegistrationAcknowledgement({ ...base, status: "submitted" }),
    ).resolves.toBeUndefined();
    expect(mocks.sendTenantWhatsApp).toHaveBeenCalledTimes(1);
    expect(mocks.warn).toHaveBeenCalledTimes(1);
    expect(mocks.warn.mock.calls[0]?.[0]).toMatchObject({ channel: "sms" });
  });

  it("logs a WhatsApp transport failure without affecting SMS", async () => {
    mocks.sendTenantWhatsApp.mockResolvedValue({ sent: false, reason: "transport_error" });
    await sendRegistrationAcknowledgement({ ...base, status: "submitted" });
    expect(mocks.sendTenantSms).toHaveBeenCalledTimes(1);
    expect(mocks.warn).toHaveBeenCalledTimes(1);
    expect(mocks.warn.mock.calls[0]?.[0]).toMatchObject({ channel: "whatsapp" });
  });
});
