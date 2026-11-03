import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Message } from "@mms/shared";

const { state } = vi.hoisted(() => ({
  state: {
    values: null as Record<string, unknown> | null,
    conflict: null as Record<string, unknown> | null,
  },
}));

vi.mock("../db/tenant-context.js", () => ({
  withTenant: async (_tenant: string, callback: (tx: unknown) => Promise<unknown>) =>
    callback({
      insert: () => ({
        values: (row: Record<string, unknown>) => {
          state.values = row;
          return {
            onConflictDoUpdate: async (config: Record<string, unknown>) => {
              state.conflict = config;
            },
          };
        },
      }),
    }),
}));

import { saveMessageLog } from "../db/repositories/messagingLogsRepository.js";

const RECORD: Message = {
  id: "log-1",
  userId: "u-1",
  contactId: "c-1",
  channel: "sms",
  body: "Hello",
  sentAt: "2026-11-04T00:00:00.000Z",
  status: "sent",
  category: "general",
  deletedAt: "2026-11-01T00:00:00.000Z",
  deletedBy: "u-2",
  deletionReason: "manual",
};

describe("saveMessageLog", () => {
  beforeEach(() => {
    state.values = null;
    state.conflict = null;
  });

  it("does not copy soft-delete columns on conflict (no unattributed resurrection)", async () => {
    await saveMessageLog("demo", RECORD);

    const set = state.conflict?.set as Record<string, unknown>;
    expect(Object.keys(set)).not.toContain("deletedAt");
    expect(Object.keys(set)).not.toContain("deletedBy");
    expect(Object.keys(set)).not.toContain("deletionReason");
    expect(set).toEqual(expect.objectContaining({ status: expect.anything() }));
    expect(state.conflict?.target).toBeDefined();
  });
});
