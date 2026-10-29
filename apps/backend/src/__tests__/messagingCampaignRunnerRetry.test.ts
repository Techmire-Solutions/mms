import { beforeEach, describe, expect, it, vi } from "vitest";

const { runners, claimMock, updateMock, sendSmsMock } = vi.hoisted(() => ({
  runners: new Map<string, (payload: unknown, ctx: unknown) => Promise<void>>(),
  claimMock: vi.fn(),
  updateMock: vi.fn(),
  sendSmsMock: vi.fn(),
}));

vi.mock("../services/backgroundJobWorkerService.js", () => ({
  registerBackgroundJobRunner: (
    key: string,
    runner: (payload: unknown, ctx: unknown) => Promise<void>,
  ) => {
    runners.set(key, runner);
  },
}));
vi.mock("../messaging/use-cases/messagingUseCases.js", () => ({
  messagingUseCases: {
    claimMessageLogForDelivery: (...args: unknown[]) => claimMock(...args),
    updateMessageLogDeliveryStatus: (...args: unknown[]) => updateMock(...args),
  },
}));
vi.mock("../services/sms/smsService.js", () => ({
  sendTenantSms: (...args: unknown[]) => sendSmsMock(...args),
}));
vi.mock("../services/whatsapp/whatsappService.js", () => ({ sendTenantWhatsApp: vi.fn() }));
vi.mock("../services/email/emailService.js", () => ({ sendTenantEmail: vi.fn() }));
vi.mock("../lib/livePush.js", () => ({
  broadcastCollection: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../lib/tenantContext.js", () => ({
  runWithTenant: (_tenant: string, callback: () => Promise<void>) => callback(),
}));
vi.mock("../lib/logger.js", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { registerMessagingCampaignJobRunner } from "../services/messagingCampaignJobRunner.js";
import { buildMessageLogClaimId } from "../lib/messageLogClaimId.js";

function makeContext() {
  return {
    tenant: "tenant-1",
    userId: "user-1",
    jobId: "job-1",
    updateProgress: vi.fn().mockResolvedValue(undefined),
    complete: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue(undefined),
  };
}

describe("messaging campaign retry idempotency", () => {
  beforeEach(() => {
    claimMock.mockReset();
    updateMock.mockReset().mockResolvedValue(undefined);
    sendSmsMock.mockReset().mockResolvedValue({ sent: true });
    registerMessagingCampaignJobRunner();
  });

  it("sends only recipients whose claim succeeded and records the outcome", async () => {
    claimMock.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const runner = runners.get("messaging:dispatch")!;
    const ctx = makeContext();

    await runner(
      {
        channel: "sms",
        recipients: [
          { id: "c-1", phone: "111" },
          { id: "c-2", phone: "222" },
        ],
        message: "Hello {name}",
        category: "general",
      },
      ctx,
    );

    expect(sendSmsMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith(
      "tenant-1",
      buildMessageLogClaimId("job-1", "c-1", "sms"),
      "sent",
      null,
    );
    expect(ctx.complete).toHaveBeenCalledWith(
      expect.objectContaining({ label: expect.stringContaining("1 sent") }),
    );
  });

  it("skips every recipient already claimed by the previous attempt", async () => {
    claimMock.mockResolvedValue(false);
    const runner = runners.get("messaging:dispatch")!;
    const ctx = makeContext();

    await runner(
      {
        channel: "sms",
        recipients: [
          { id: "c-1", phone: "111" },
          { id: "c-2", phone: "222" },
        ],
        message: "Hello",
        category: "general",
      },
      ctx,
    );

    expect(sendSmsMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
    expect(ctx.complete).toHaveBeenCalledWith(
      expect.objectContaining({ label: expect.stringContaining("2 skipped") }),
    );
  });
});
