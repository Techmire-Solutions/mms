import { beforeEach, describe, expect, it, vi } from "vitest";

const { runners, claimMock, outcomeBatchMock, sendSmsMock } = vi.hoisted(() => ({
  runners: new Map<string, (payload: unknown, ctx: unknown) => Promise<void>>(),
  claimMock: vi.fn(),
  outcomeBatchMock: vi.fn(),
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
    saveMessageLogDeliveryOutcomes: (...args: unknown[]) => outcomeBatchMock(...args),
    updateMessageLogDeliveryStatus: vi.fn(),
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

import {
  MESSAGING_OUTCOME_BATCH_SIZE,
  MESSAGING_PROGRESS_INTERVAL,
  registerMessagingCampaignJobRunner,
} from "../services/messagingCampaignJobRunner.js";
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

function recipients(count: number) {
  return Array.from({ length: count }, (_, i) => ({ id: `c-${i + 1}`, phone: `${i}` }));
}

describe("messaging campaign retry idempotency", () => {
  beforeEach(() => {
    claimMock.mockReset().mockResolvedValue(true);
    outcomeBatchMock.mockReset().mockResolvedValue(undefined);
    sendSmsMock.mockReset().mockResolvedValue({ sent: true });
    registerMessagingCampaignJobRunner();
  });

  it("sends only recipients whose claim succeeded and batches their outcomes", async () => {
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
    expect(outcomeBatchMock).toHaveBeenCalledTimes(1);
    const [tenant, outcomes] = outcomeBatchMock.mock.calls[0] as [
      string,
      Array<{ id: string; status: string; errorMessage?: string | null }>,
    ];
    expect(tenant).toBe("tenant-1");
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]).toEqual(
      expect.objectContaining({
        id: buildMessageLogClaimId("job-1", "c-1", "sms"),
        status: "sent",
        errorMessage: null,
      }),
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
    expect(outcomeBatchMock).not.toHaveBeenCalled();
    expect(ctx.complete).toHaveBeenCalledWith(
      expect.objectContaining({ label: expect.stringContaining("2 skipped") }),
    );
  });

  it("flushes outcomes in batches instead of one write per recipient", async () => {
    const total = MESSAGING_OUTCOME_BATCH_SIZE + 1;
    const runner = runners.get("messaging:dispatch")!;
    const ctx = makeContext();

    await runner(
      {
        channel: "sms",
        recipients: recipients(total),
        message: "Hello",
        category: "general",
      },
      ctx,
    );

    expect(sendSmsMock).toHaveBeenCalledTimes(total);
    expect(outcomeBatchMock).toHaveBeenCalledTimes(2);
    const [firstBatch, secondBatch] = outcomeBatchMock.mock.calls.map(
      (call) => (call as [string, unknown[]])[1],
    );
    expect(firstBatch).toHaveLength(MESSAGING_OUTCOME_BATCH_SIZE);
    expect(secondBatch).toHaveLength(1);
  });

  it("updates progress on the coarse cadence, not every few recipients", async () => {
    const total = MESSAGING_PROGRESS_INTERVAL * 2 + 1;
    const runner = runners.get("messaging:dispatch")!;
    const ctx = makeContext();

    await runner(
      {
        channel: "sms",
        recipients: recipients(total),
        message: "Hello",
        category: "general",
      },
      ctx,
    );

    const ticks = ctx.updateProgress.mock.calls as Array<[number, number]>;
    expect(ticks.map(([current]) => current)).toEqual([
      MESSAGING_PROGRESS_INTERVAL,
      MESSAGING_PROGRESS_INTERVAL * 2,
      total,
    ]);
  });

  it("persists the tail batch even when the run is aborted", async () => {
    const ctx = makeContext();
    const runner = runners.get("messaging:dispatch")!;
    // Abort is observed at the top of the next iteration, after recipient 1 was sent.
    sendSmsMock.mockImplementation(async () => {
      (ctx as unknown as { signal: { aborted: boolean } }).signal = { aborted: true };
      return { sent: true };
    });

    // The abort guard rejects the run so BullMQ retries it; the delivered
    // recipient's outcome must still have been persisted first.
    await expect(
      runner(
        {
          channel: "sms",
          recipients: recipients(3),
          message: "Hello",
          category: "general",
        },
        ctx,
      ),
    ).rejects.toThrow();

    expect(outcomeBatchMock).toHaveBeenCalledTimes(1);
    const [, outcomes] = outcomeBatchMock.mock.calls[0] as [string, unknown[]];
    expect(outcomes).toHaveLength(1);
  });
});
