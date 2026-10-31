import { beforeEach, describe, expect, it, vi } from "vitest";

const { state } = vi.hoisted(() => ({
  state: {
    inserted: [] as Array<{ id: string }>,
    reclaimed: [] as Array<{ id: string }>,
    insertValues: null as Record<string, unknown> | null,
    updateWhere: null as unknown,
  },
}));

vi.mock("../db/tenant-context.js", () => ({
  withTenant: async (_tenant: string, callback: (tx: unknown) => Promise<unknown>) =>
    callback({
      insert: () => ({
        values: (values: Record<string, unknown>) => {
          state.insertValues = values;
          return {
            onConflictDoNothing: () => ({
              returning: async () => state.inserted,
            }),
          };
        },
      }),
      update: () => ({
        set: () => ({
          where: (clause: unknown) => {
            state.updateWhere = clause;
            return { returning: async () => state.reclaimed };
          },
        }),
      }),
    }),
}));

import {
  buildMessageLogClaimId,
  claimMessageLogForDelivery,
} from "../db/repositories/messagingLogsMutationRepository.js";

const claim = {
  id: "claim-1",
  userId: "user-1",
  contactId: "contact-1",
  channel: "sms",
  body: "Hello",
  sentAt: "2026-10-29T10:00:00.000Z",
  category: "general",
};

describe("messaging delivery claims", () => {
  beforeEach(() => {
    state.inserted = [];
    state.reclaimed = [];
    state.insertValues = null;
    state.updateWhere = null;
  });

  it("builds a deterministic per-recipient id", () => {
    const id = buildMessageLogClaimId("job-1", "contact-1", "sms");
    expect(id).toBe(buildMessageLogClaimId("job-1", "contact-1", "sms"));
    expect(id).toMatch(/^msg-[0-9a-f]{64}$/);
    expect(id).not.toBe(buildMessageLogClaimId("job-2", "contact-1", "sms"));
  });

  it("claims a recipient by inserting a sending row", async () => {
    state.inserted = [{ id: claim.id }];

    const claimed = await claimMessageLogForDelivery("tenant-1", claim);

    expect(claimed).toBe(true);
    expect(state.insertValues?.status).toBe("sending");
    expect(state.insertValues?.workspaceSubdomain).toBe("tenant-1");
  });

  it("skips a recipient already claimed by an earlier attempt", async () => {
    const claimed = await claimMessageLogForDelivery("tenant-1", claim);

    expect(claimed).toBe(false);
    expect(state.updateWhere).not.toBeNull();
  });

  it("reclaims a stale sending row", async () => {
    state.reclaimed = [{ id: claim.id }];

    await expect(claimMessageLogForDelivery("tenant-1", claim)).resolves.toBe(true);
  });
});
