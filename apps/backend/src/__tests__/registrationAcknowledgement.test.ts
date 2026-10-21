import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  sendTenantSms: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("../services/sms/smsService.js", () => ({ sendTenantSms: mocks.sendTenantSms }));
vi.mock("../lib/logger.js", () => ({ logger: { warn: mocks.warn } }));

const { sendRegistrationAcknowledgement } = await import(
  "../enrollments/use-cases/registrationAcknowledgement.js"
);

const base = { phone: "+923001234567", reference: "APP-7K2QX9MD", workspaceName: "Al Noor" };

describe("sendRegistrationAcknowledgement", () => {
  beforeEach(() => {
    mocks.sendTenantSms.mockReset();
    mocks.warn.mockReset();
    mocks.sendTenantSms.mockResolvedValue({ sent: true });
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
});
